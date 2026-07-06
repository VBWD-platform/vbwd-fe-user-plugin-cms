import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount, RouterLinkStub, flushPromises } from '@vue/test-utils';

const getMock = vi.fn();

vi.mock('@/api', () => ({
  api: { get: (...args: unknown[]) => getMock(...args) },
  isAuthenticated: () => false,
}));

// CmsPage (rendered by CmsHomePage) reads route.query for a preview token.
// The home page carries no route params — the slug comes from CmsHomePage's
// resolved home slug, NOT the URL — so params is deliberately empty.
vi.mock('vue-router', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('vue-router');
  return {
    ...actual,
    useRoute: () => ({ params: {}, query: {} }),
  };
});

import CmsHomePage from '../../src/views/CmsHomePage.vue';
import CmsPageTypePage from '../../src/views/CmsPageTypePage.vue';
import CmsPageTypePost from '../../src/views/CmsPageTypePost.vue';
import { useCmsStore } from '../../src/stores/useCmsStore';
import {
  registerCmsPageType,
  resetCmsPageTypes,
} from '../../src/registry/pageTypeRegistry';

const HOME_LAYOUT = {
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

function mountHome() {
  return mount(CmsHomePage, {
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

describe('CmsHomePage — canonical `/` renders the home post in place (no redirect)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
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

  it('cold load (anon, no __POST__ handoff) renders the home post via GET /cms/posts/index, NOT the 404 block', async () => {
    // The routing-rules fetch is irrelevant here: CmsHomePage renders the home
    // post directly, with zero dependency on the (fail-open) routing guard.
    getMock.mockImplementation(async (url: string) => {
      if (url === '/cms/posts/index') {
        return {
          id: 'p-index',
          type: 'page',
          slug: 'index',
          title: 'Home',
          content_html: '<p>Home body from index</p>',
          content_json: null,
          layout_id: 'L1',
          style_id: null,
        };
      }
      if (url === '/cms/layouts/L1') return HOME_LAYOUT;
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    const wrapper = mountHome();
    await flushPromises();

    const calledUrls = getMock.mock.calls.map((call) => call[0]);
    expect(calledUrls).toContain('/cms/posts/index');
    // The baked default is `index`, never the legacy `/home` bounce target.
    expect(calledUrls).not.toContain('/cms/posts/home');
    expect(wrapper.find('.cms-page__not-found').exists()).toBe(false);
    expect(wrapper.html()).toContain('Home body from index');
  });

  it('with the __POST__ handoff (slug index) it mounts synchronously WITHOUT an API fetch', async () => {
    const script = document.createElement('script');
    script.type = 'application/json';
    script.id = '__POST__';
    script.textContent = JSON.stringify({
      slug: 'index',
      title: 'Home',
      content_html: '<p>Home body from handoff</p>',
      seo: { canonical_url: 'https://vbwd.cc/' },
    });
    document.body.appendChild(script);

    const wrapper = mountHome();
    await flushPromises();

    const calledUrls = getMock.mock.calls.map((call) => call[0]);
    expect(calledUrls).not.toContain('/cms/posts/index');
    expect(wrapper.html()).toContain('Home body from handoff');
    const store = useCmsStore();
    expect(store.currentPage?.slug).toBe('index');
  });
});
