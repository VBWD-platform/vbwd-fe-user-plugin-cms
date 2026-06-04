import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, RouterLinkStub, flushPromises } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

const bySlugMock = vi.fn();

vi.mock('../../src/composables/usePosts', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '../../src/composables/usePosts',
  );
  return {
    ...actual,
    usePosts: () => ({
      bySlug: bySlugMock,
      current: { value: null },
      items: { value: [] },
      loading: { value: false },
      page: { value: 1 },
      pages: { value: 1 },
      total: { value: 0 },
    }),
  };
});

import PostDetail from '../../src/views/PostDetail.vue';
import {
  registerPostContentType,
  resetPostContentTypes,
} from '../../src/registry/contentTypeRegistry';

const RichText = defineComponent({
  name: 'RichText',
  props: { data: { type: Object, required: true } },
  // eslint-disable-next-line vue/no-v-html
  render(this: { data: { html?: string } }) {
    return h('div', { class: 'rt', innerHTML: this.data.html ?? '' });
  },
});

const Hero = defineComponent({
  name: 'Hero',
  props: { data: { type: Object, required: true } },
  render() {
    return h('div', { class: 'hero' }, 'HERO');
  },
});

function setHandoff(payload: unknown) {
  const script = document.createElement('script');
  script.type = 'application/json';
  script.id = '__POST__';
  script.textContent = JSON.stringify(payload);
  document.body.appendChild(script);
}

function mountDetail(slug = 'hello-world') {
  return mount(PostDetail, {
    props: { slug, type: 'post' },
    global: {
      stubs: { RouterLink: RouterLinkStub },
      mocks: { $t: (key: string, fallback?: string) => fallback ?? key },
    },
  });
}

describe('PostDetail', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.title = '';
    bySlugMock.mockReset();
    resetPostContentTypes();
    registerPostContentType('richtext', RichText, { placement: 'inline' });
  });

  it('mounts from the inlined #__POST__ handoff WITHOUT calling the API', async () => {
    setHandoff({
      slug: 'hello-world',
      title: 'Hello World',
      content_html: '<p>Body from handoff</p>',
      seo: { canonical_url: 'https://x/hello-world', meta_description: 'desc' },
    });

    const wrapper = mountDetail();
    await flushPromises();

    expect(bySlugMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Hello World');
    expect(wrapper.html()).toContain('Body from handoff');
  });

  it('falls back to bySlug when no handoff is present', async () => {
    bySlugMock.mockResolvedValue({
      id: '1',
      type: 'post',
      slug: 'hello-world',
      title: 'Fetched Title',
      content_html: '<p>Fetched body</p>',
      content_json: {},
    });

    const wrapper = mountDetail();
    await flushPromises();

    expect(bySlugMock).toHaveBeenCalledWith('post', 'hello-world');
    expect(wrapper.text()).toContain('Fetched Title');
  });

  it('renders a content_html-only post as one implicit richtext block (back-compat)', async () => {
    bySlugMock.mockResolvedValue({
      id: '1',
      type: 'post',
      slug: 'legacy',
      title: 'Legacy',
      content_html: '<p>Legacy HTML body</p>',
      content_json: {},
    });

    const wrapper = mountDetail('legacy');
    await flushPromises();

    expect(wrapper.html()).toContain('Legacy HTML body');
  });

  it('renders top-placement blocks above in-flow blocks regardless of position', async () => {
    registerPostContentType('hero', Hero, { placement: 'top' });
    bySlugMock.mockResolvedValue({
      id: '1',
      type: 'post',
      slug: 'mixed',
      title: 'Mixed',
      content_html: null,
      content_json: {
        blocks: [
          { type: 'richtext', position: 0, data: { html: '<p>FlowText</p>' } },
          { type: 'hero', position: 1, data: {} },
        ],
      },
    });

    const wrapper = mountDetail('mixed');
    await flushPromises();

    const html = wrapper.html();
    expect(html.indexOf('HERO')).toBeLessThan(html.indexOf('FlowText'));
  });

  it('renders an unknown block as a quiet fallback (never crashes)', async () => {
    bySlugMock.mockResolvedValue({
      id: '1',
      type: 'post',
      slug: 'weird',
      title: 'Weird',
      content_html: null,
      content_json: {
        blocks: [{ type: 'totally-unknown', position: 0, data: {} }],
      },
    });

    const wrapper = mountDetail('weird');
    await flushPromises();

    expect(wrapper.find('[data-testid="unsupported-block"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Weird');
  });

  it('injects de-duplicated SEO meta from the post', async () => {
    setHandoff({
      slug: 'hello-world',
      title: 'Hello World',
      content_html: '<p>x</p>',
      seo: { canonical_url: 'https://x/hello-world', meta_description: 'My description' },
    });

    mountDetail();
    await flushPromises();

    const canonical = document.head.querySelectorAll('link[rel="canonical"]');
    expect(canonical.length).toBe(1);
    expect(canonical[0].getAttribute('href')).toBe('https://x/hello-world');
    const desc = document.head.querySelectorAll('meta[name="description"]');
    expect(desc.length).toBe(1);
    expect(desc[0].getAttribute('content')).toBe('My description');
  });

  it('renders a breadcrumb from the parent chain for a hierarchical page', async () => {
    bySlugMock.mockResolvedValue({
      id: '3',
      type: 'page',
      slug: 'about/team',
      title: 'Team',
      content_html: '<p>team</p>',
      content_json: {},
      ancestors: [
        { slug: 'about', title: 'About' },
      ],
    });

    const wrapper = mountDetail('about/team');
    await flushPromises();

    const crumbs = wrapper.find('[data-testid="post-breadcrumb"]');
    expect(crumbs.exists()).toBe(true);
    expect(crumbs.text()).toContain('About');
    expect(crumbs.text()).toContain('Team');
  });
});
