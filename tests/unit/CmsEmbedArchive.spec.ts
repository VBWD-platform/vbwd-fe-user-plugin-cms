import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, RouterLinkStub, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import type { PostSummary } from '../../src/composables/usePosts';

// The archive view fetches through the single usePosts.byTerm path; mock the
// composable so the spec drives items / pagination state deterministically.
const byTermMock = vi.fn();
const items = ref<PostSummary[]>([]);
const page = ref(1);
const pages = ref(1);
const total = ref(0);
const loading = ref(false);

vi.mock('../../src/composables/usePosts', () => ({
  usePosts: () => ({
    items,
    page,
    pages,
    total,
    loading,
    byTerm: byTermMock,
  }),
}));

let routeParams: Record<string, string> = {};
vi.mock('vue-router', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('vue-router');
  return {
    ...actual,
    useRoute: () => ({ params: routeParams }),
  };
});

import CmsEmbedArchive from '../../src/views/CmsEmbedArchive.vue';

function makePost(suffix: number): PostSummary {
  return {
    id: String(suffix),
    type: 'post',
    slug: `post-${suffix}`,
    title: `Post ${suffix}`,
    excerpt: `Excerpt ${suffix}`,
    content_html: `<p>Body ${suffix}</p>`,
    published_at: '2026-06-01T10:00:00+00:00',
    author_id: 'author-1',
    og_image_url: null,
  } as PostSummary;
}

function mountArchive(type: string, category: string) {
  routeParams = { type, category };
  return mount(CmsEmbedArchive, {
    global: {
      stubs: { RouterLink: RouterLinkStub },
      mocks: { $t: (_key: string, fallback?: string) => fallback ?? _key },
    },
  });
}

describe('CmsEmbedArchive (chrome-light category browser)', () => {
  beforeEach(() => {
    byTermMock.mockReset();
    byTermMock.mockResolvedValue({ items: [], total: 0, page: 1, per_page: 20, pages: 1 });
    items.value = [];
    page.value = 1;
    pages.value = 1;
    total.value = 0;
    loading.value = false;
  });

  it('fetches the configured type within the category via byTerm on mount', async () => {
    mountArchive('video', 'news');
    await flushPromises();

    expect(byTermMock).toHaveBeenCalledWith('video', 'category', 'news', 1);
  });

  it('lists the fetched posts through PostList', async () => {
    items.value = [makePost(1), makePost(2)];
    total.value = 2;
    const wrapper = mountArchive('post', 'news');
    await flushPromises();

    expect(wrapper.findAll('[data-testid="post-card"]')).toHaveLength(2);
  });

  it('links post cards within embed mode (/cms/embed/<type>/post/<slug>)', async () => {
    items.value = [makePost(1)];
    total.value = 1;
    const wrapper = mountArchive('post', 'news');
    await flushPromises();

    const link = wrapper.findComponent(RouterLinkStub);
    expect(link.props('to')).toBe('/cms/embed/post/post/post-1');
  });

  it('shows the not-found / empty state for an unknown or empty category', async () => {
    byTermMock.mockResolvedValue(null);
    items.value = [];
    total.value = 0;
    const wrapper = mountArchive('post', 'does-not-exist');
    await flushPromises();

    expect(wrapper.find('[data-testid="cms-embed-archive-empty"]').exists()).toBe(true);
    // The generic PostList empty state is NOT what we want here — the archive
    // owns an explicit not-found message.
    expect(wrapper.findAll('[data-testid="post-card"]')).toHaveLength(0);
  });

  it('advances to the next page (calls byTerm with the next page) when pages > 1', async () => {
    items.value = [makePost(1)];
    total.value = 40;
    page.value = 1;
    pages.value = 3;
    const wrapper = mountArchive('post', 'news');
    await flushPromises();
    byTermMock.mockClear();

    const next = wrapper.find('[data-testid="cms-embed-archive-next"]');
    expect(next.exists()).toBe(true);
    await next.trigger('click');
    await flushPromises();

    expect(byTermMock).toHaveBeenCalledWith('post', 'category', 'news', 2);
  });
});
