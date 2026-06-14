import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount, RouterLinkStub, flushPromises } from '@vue/test-utils';

const getMock = vi.fn();

vi.mock('@/api', () => ({
  api: { get: (...args: unknown[]) => getMock(...args) },
  isAuthenticated: () => false,
}));

let currentSlug = '';
vi.mock('vue-router', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('vue-router');
  return {
    ...actual,
    useRoute: () => ({ params: { slug: currentSlug }, query: {} }),
  };
});

import CmsPage from '../../src/views/CmsPage.vue';
import CmsPageTypePage from '../../src/views/CmsPageTypePage.vue';
import CmsPageTypePost from '../../src/views/CmsPageTypePost.vue';
import { useCmsStore } from '../../src/stores/useCmsStore';
import {
  registerCmsPageType,
  resetCmsPageTypes,
} from '../../src/registry/pageTypeRegistry';

const POST_LAYOUT = {
  id: 'L1',
  slug: 'default',
  name: 'Default',
  areas: [{ name: 'content', type: 'content', label: 'Content' }],
  assignments: [],
};

function stubFetchCss(css: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, text: async () => css })),
  );
}

function mountPage(slug: string) {
  currentSlug = slug;
  return mount(CmsPage, {
    props: { slug },
    global: {
      stubs: {
        RouterLink: RouterLinkStub,
        CmsLayoutRenderer: {
          props: ['layout', 'contentHtml', 'contentBlocks', 'pageAssignments'],
          // eslint-disable-next-line vue/no-v-html
          template: '<div class="layout-stub" v-html="contentHtml" />',
        },
      },
      mocks: {
        $t: (_key: string, fallback?: string) => fallback ?? _key,
        $router: { back: vi.fn() },
      },
    },
  });
}

describe('CmsPage public renderer (unified cms_post cutover)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Mirror the plugin install(): register the built-in page types so the
    // dispatcher resolves them (real components, not stubs) end-to-end.
    resetCmsPageTypes();
    registerCmsPageType('page', CmsPageTypePage);
    registerCmsPageType('post', CmsPageTypePost);
    getMock.mockReset();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.title = '';
    stubFetchCss('.themed{}');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches a page slug from /cms/posts and renders its content inside the layout', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === '/cms/posts/home') {
        return {
          id: 'p-home',
          type: 'page',
          slug: 'home',
          title: 'Home',
          content_html: '<p>Home body</p>',
          content_json: null,
          layout_id: 'L1',
          style_id: 'S1',
          use_theme_switcher_styles: false,
        };
      }
      if (url === '/cms/layouts/L1') return POST_LAYOUT;
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    const wrapper = mountPage('home');
    await flushPromises();

    const calledUrls = getMock.mock.calls.map((call) => call[0]);
    expect(calledUrls).toContain('/cms/posts/home');
    expect(calledUrls).not.toContain('/cms/pages/home');
    expect(wrapper.find('.layout-stub').exists()).toBe(true);
    expect(wrapper.html()).toContain('Home body');
  });

  it('renders a type=post slug (the test23 case) — page→post fallback when bare 404s', async () => {
    getMock.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === '/cms/posts/test23') {
        const type = config?.params?.type;
        if (type === 'post') {
          return {
            id: 'p-23',
            type: 'post',
            slug: 'test23',
            title: 'test23',
            content_html: 'test html content',
            content_json: { blocks: [{ type: 'richtext', position: 0, data: { html: 'test html content' } }] },
            layout_id: null,
            style_id: null,
            use_theme_switcher_styles: true,
          };
        }
        // bare (page) attempt 404s
        const error = new Error('not found') as Error & { response?: { status: number } };
        error.response = { status: 404 };
        throw error;
      }
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    const wrapper = mountPage('test23');
    await flushPromises();

    expect(wrapper.html()).toContain('test html content');
    const store = useCmsStore();
    expect(store.currentPage?.slug).toBe('test23');
  });

  it('injects the post title heading + tags into the content body (never above the page, never the excerpt)', async () => {
    getMock.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === '/cms/posts/my-post') {
        if (config?.params?.type === 'post') {
          return {
            id: 'p-1',
            type: 'post',
            slug: 'my-post',
            title: 'My Great Post',
            excerpt: 'A short summary of the post.',
            content_html: '<p>Body copy here</p>',
            content_json: null,
            layout_id: 'L1',
            style_id: null,
            terms: [{ id: 't1', term_type: 'tag', slug: 'vue', name: 'Vue' }],
          };
        }
        const error = new Error('not found') as Error & { response?: { status: number } };
        error.response = { status: 404 };
        throw error;
      }
      if (url === '/cms/layouts/L1') return POST_LAYOUT;
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    const wrapper = mountPage('my-post');
    await flushPromises();

    const html = wrapper.html();
    // Title heading + tags are injected under the header, into the content body.
    expect(html).toContain('cms-post-title');
    expect(html).toContain('My Great Post');
    expect(html).toContain('cms-post-tags');
    expect(html).toContain('href="/tag?tag=vue"');
    expect(html).toContain('Body copy here');
    // The excerpt is never injected (the post body keeps its own lead).
    expect(html).not.toContain('cms-post-excerpt');
    expect(html).not.toContain('A short summary of the post.');
    // Title → tags → body order (tags under the heading, both above the content).
    expect(html.indexOf('cms-post-title')).toBeLessThan(html.indexOf('cms-post-tags'));
    expect(html.indexOf('cms-post-tags')).toBeLessThan(html.indexOf('Body copy here'));
  });

  it('does NOT auto-prepend a title header for a page (pages author their own)', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === '/cms/posts/showcase') {
        return {
          id: 'pg-1',
          type: 'page',
          slug: 'showcase',
          title: 'Theme Showcase',
          excerpt: 'should not be auto-rendered',
          content_html: '<section><h1>Theme Showcase</h1></section>',
          content_json: null,
          layout_id: 'L1',
          style_id: null,
        };
      }
      if (url === '/cms/layouts/L1') return POST_LAYOUT;
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    const wrapper = mountPage('showcase');
    await flushPromises();

    const html = wrapper.html();
    expect(html).not.toContain('cms-post-header');
    expect(html).not.toContain('should not be auto-rendered');
  });

  it('mounts synchronously from the __POST__ handoff WITHOUT calling the API', async () => {
    const script = document.createElement('script');
    script.type = 'application/json';
    script.id = '__POST__';
    script.textContent = JSON.stringify({
      slug: 'about',
      title: 'About Us',
      content_html: '<p>About body from handoff</p>',
      seo: { meta_description: 'desc', canonical_url: 'https://x/about' },
    });
    document.body.appendChild(script);

    const wrapper = mountPage('about');
    await flushPromises();

    const calledUrls = getMock.mock.calls.map((call) => call[0]);
    expect(calledUrls).not.toContain('/cms/posts/about');
    expect(wrapper.html()).toContain('About body from handoff');
  });

  it('injects de-duplicated SEO meta from the post', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === '/cms/posts/seo-page') {
        return {
          id: 'p-seo',
          type: 'page',
          slug: 'seo-page',
          title: 'SEO Page',
          meta_title: 'SEO Meta Title',
          meta_description: 'My SEO description',
          canonical_url: 'https://x/seo-page',
          content_html: '<p>x</p>',
          content_json: null,
          layout_id: null,
          style_id: null,
          use_theme_switcher_styles: false,
        };
      }
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    mountPage('seo-page');
    await flushPromises();

    const desc = document.head.querySelectorAll('meta[name="description"]');
    expect(desc.length).toBe(1);
    expect(desc[0].getAttribute('content')).toBe('My SEO description');
    const canonical = document.head.querySelectorAll('link[rel="canonical"]');
    expect(canonical.length).toBe(1);
    expect(document.title).toBe('SEO Meta Title');
  });

  it('layers the page source_css (CSS tab) on top of the resolved style', async () => {
    stubFetchCss('.from-style{color:red}');
    getMock.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === '/cms/posts/themed') {
        if (config?.params?.type === 'post') {
          return {
            id: 'p-themed',
            type: 'post',
            slug: 'themed',
            title: 'Themed',
            content_html: '<p>themed body</p>',
            content_json: null,
            layout_id: null,
            style_id: null,
            resolved_style_id: 'DEFAULT-STYLE',
            source_css: '.from-tab{color:blue}',
          };
        }
        const error = new Error('not found') as Error & { response?: { status: number } };
        error.response = { status: 404 };
        throw error;
      }
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    mountPage('themed');
    await flushPromises();

    const tags = document.head.querySelectorAll('style[data-cms-page-style]');
    expect(tags.length).toBe(1);
    const css = tags[0].textContent ?? '';
    // resolved style first, then the CSS-tab override after it (so it wins)
    expect(css).toContain('.from-style');
    expect(css).toContain('.from-tab');
    expect(css.indexOf('.from-style')).toBeLessThan(css.indexOf('.from-tab'));
  });

  it('applies the resolved default style when the post has no explicit style_id', async () => {
    // The backend resolves `resolved_style_id` to the admin-designated default
    // when the post/page carries no explicit style. The renderer must fetch +
    // inject it (theme-switcher off) so default styles reach the public page.
    stubFetchCss('.default-theme{color:rebeccapurple}');
    getMock.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === '/cms/posts/test23') {
        if (config?.params?.type === 'post') {
          return {
            id: 'p-23',
            type: 'post',
            slug: 'test23',
            title: 'test23',
            content_html: '<p>body</p>',
            content_json: null,
            layout_id: null,
            style_id: null,
            resolved_style_id: 'DEFAULT-STYLE',
            resolved_style_source: 'default',
            use_theme_switcher_styles: false,
          };
        }
        const error = new Error('not found') as Error & { response?: { status: number } };
        error.response = { status: 404 };
        throw error;
      }
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    mountPage('test23');
    await flushPromises();

    const tags = document.head.querySelectorAll('style[data-cms-page-style]');
    expect(tags.length).toBe(1);
    expect(tags[0].textContent).toContain('rebeccapurple');
  });

  it('renders the default layout (resolved_layout_id) when the post has no explicit layout_id', async () => {
    // S54: the backend resolves `resolved_layout_id` to the admin-designated
    // default layout for a layout-less (e.g. imported) post. The renderer must
    // prefer it so the page renders with chrome, not a bare <article>.
    getMock.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === '/cms/posts/imported') {
        if (config?.params?.type === 'post') {
          return {
            id: 'p-imp',
            type: 'post',
            slug: 'imported',
            title: 'Imported',
            content_html: '<p>imported body</p>',
            content_json: null,
            layout_id: null,
            resolved_layout_id: 'L1',
            resolved_layout_source: 'default',
            style_id: null,
          };
        }
        const error = new Error('not found') as Error & { response?: { status: number } };
        error.response = { status: 404 };
        throw error;
      }
      if (url === '/cms/layouts/L1') return POST_LAYOUT;
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    const wrapper = mountPage('imported');
    await flushPromises();

    const calledUrls = getMock.mock.calls.map((call) => call[0]);
    expect(calledUrls).toContain('/cms/layouts/L1');
    expect(wrapper.find('.layout-stub').exists()).toBe(true);
    expect(wrapper.find('article').exists()).toBe(false);
  });

  it('prefers resolved_layout_id over a raw layout_id when both are present', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === '/cms/posts/home') {
        return {
          id: 'p-home',
          type: 'page',
          slug: 'home',
          title: 'Home',
          content_html: '<p>Home body</p>',
          content_json: null,
          layout_id: 'L-RAW',
          resolved_layout_id: 'L1',
          resolved_layout_source: 'explicit',
          style_id: null,
        };
      }
      if (url === '/cms/layouts/L1') return POST_LAYOUT;
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    mountPage('home');
    await flushPromises();

    const calledUrls = getMock.mock.calls.map((call) => call[0]);
    expect(calledUrls).toContain('/cms/layouts/L1');
    expect(calledUrls).not.toContain('/cms/layouts/L-RAW');
  });

  it('still renders a bare <article> for a truly layout-less post (no default)', async () => {
    getMock.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === '/cms/posts/plain') {
        if (config?.params?.type === 'post') {
          return {
            id: 'p-plain',
            type: 'post',
            slug: 'plain',
            title: 'Plain',
            content_html: '<p>plain body</p>',
            content_json: null,
            layout_id: null,
            resolved_layout_id: null,
            resolved_layout_source: 'none',
            style_id: null,
          };
        }
        const error = new Error('not found') as Error & { response?: { status: number } };
        error.response = { status: 404 };
        throw error;
      }
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    const wrapper = mountPage('plain');
    await flushPromises();

    expect(wrapper.find('.layout-stub').exists()).toBe(false);
    expect(wrapper.find('article').exists()).toBe(true);
    expect(wrapper.html()).toContain('plain body');
  });

  it('feeds content_blocks + page_assignments from the post response into CmsLayoutRenderer', async () => {
    const contentBlocks = {
      'content-above': { content_html: '<p>above block</p>', source_css: null },
    };
    const pageAssignments = [
      {
        area_name: 'sidebar-widget',
        widget_id: 'W-PAGE',
        sort_order: 0,
        required_access_level_ids: [],
        widget: { id: 'W-PAGE', slug: 'page-w', name: 'Page Widget', widget_type: 'html' },
      },
    ];

    let receivedContentBlocks: unknown;
    let receivedPageAssignments: unknown;

    currentSlug = 'areas';
    getMock.mockImplementation(async (url: string) => {
      if (url === '/cms/posts/areas') {
        return {
          id: 'p-areas',
          type: 'page',
          slug: 'areas',
          title: 'Areas',
          content_html: '<p>main body</p>',
          content_json: null,
          layout_id: 'L1',
          style_id: null,
          content_blocks: contentBlocks,
          page_assignments: pageAssignments,
        };
      }
      if (url === '/cms/layouts/L1') return POST_LAYOUT;
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    mount(CmsPage, {
      props: { slug: 'areas' },
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
          CmsLayoutRenderer: {
            props: ['layout', 'contentHtml', 'contentBlocks', 'pageAssignments'],
            setup(componentProps: { contentBlocks?: unknown; pageAssignments?: unknown }) {
              receivedContentBlocks = componentProps.contentBlocks;
              receivedPageAssignments = componentProps.pageAssignments;
              return () => null;
            },
          },
        },
        mocks: {
          $t: (_key: string, fallback?: string) => fallback ?? _key,
          $router: { back: vi.fn() },
        },
      },
    });
    await flushPromises();

    expect(receivedContentBlocks).toEqual(contentBlocks);
    expect(receivedPageAssignments).toEqual(pageAssignments);
  });

  it('dispatches type=post to the post type component (tags injected)', async () => {
    getMock.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === '/cms/posts/dispatch-post') {
        if (config?.params?.type === 'post') {
          return {
            id: 'p-dp',
            type: 'post',
            slug: 'dispatch-post',
            title: 'Dispatched Post',
            excerpt: 'post excerpt',
            content_html: '<p>post body</p>',
            content_json: null,
            layout_id: null,
            style_id: null,
            terms: [{ id: 't1', term_type: 'tag', slug: 'release', name: 'Release' }],
          };
        }
        const error = new Error('not found') as Error & { response?: { status: number } };
        error.response = { status: 404 };
        throw error;
      }
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    const wrapper = mountPage('dispatch-post');
    await flushPromises();

    // The post type component is the only one that injects tag chips — their
    // presence proves the dispatcher resolved the `post` type component.
    expect(wrapper.html()).toContain('cms-post-tags');
    expect(wrapper.html()).toContain('href="/tag?tag=release"');
  });

  it('falls back to the page type component for a page (no auto header)', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === '/cms/posts/dispatch-page') {
        return {
          id: 'pg-dp',
          type: 'page',
          slug: 'dispatch-page',
          title: 'Dispatched Page',
          excerpt: 'should not auto-render',
          content_html: '<p>page body</p>',
          content_json: null,
          layout_id: null,
          style_id: null,
        };
      }
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    const wrapper = mountPage('dispatch-page');
    await flushPromises();

    expect(wrapper.html()).not.toContain('cms-post-header');
    expect(wrapper.html()).toContain('page body');
  });

  it('renders the 404/not-found state for an unknown slug (graceful, no crash)', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === '/cms/posts/ghost') {
        const error = new Error('not found') as Error & { response?: { status: number } };
        error.response = { status: 404 };
        throw error;
      }
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    const wrapper = mountPage('ghost');
    await flushPromises();

    expect(wrapper.find('.cms-page__not-found').exists()).toBe(true);
    expect(wrapper.text()).toContain('404');
  });
});
