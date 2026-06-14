import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, RouterLinkStub, flushPromises, type VueWrapper } from '@vue/test-utils';
import { ref } from 'vue';

const byTermMock = vi.fn();
const itemsRef = { value: [] as unknown[] };
const loadingRef = { value: false };
const routeQuery = ref<Record<string, unknown>>({});

vi.mock('vue-router', () => ({
  useRoute: () => ({ get query() { return routeQuery.value; } }),
}));

vi.mock('../../src/composables/usePosts', () => ({
  usePosts: () => ({
    byTerm: byTermMock,
    items: itemsRef,
    loading: loadingRef,
    page: { value: 1 },
    pages: { value: 1 },
    total: { value: itemsRef.value.length },
  }),
}));

import TagArchive from '../../src/components/TagArchive.vue';

const mountedWrappers: VueWrapper[] = [];

function mountArchive(config: Record<string, unknown> = {}) {
  const wrapper = mount(TagArchive, {
    props: { config },
    global: {
      stubs: { RouterLink: RouterLinkStub },
      mocks: { $t: (_key: string, fallback?: string) => fallback ?? _key },
    },
  });
  mountedWrappers.push(wrapper);
  return wrapper;
}

describe('TagArchive (tag-archive widget)', () => {
  beforeEach(() => {
    byTermMock.mockReset();
    byTermMock.mockResolvedValue(undefined);
    itemsRef.value = [];
    loadingRef.value = false;
    routeQuery.value = {};
  });

  afterEach(() => {
    while (mountedWrappers.length) mountedWrappers.pop()?.unmount();
  });

  it('reads ?tag= from the URL and calls byTerm on mount', async () => {
    routeQuery.value = { tag: 'release' };
    mountArchive({ type: 'post', term_type: 'tag', limit: 12 });
    await flushPromises();

    expect(byTermMock).toHaveBeenCalledWith('post', 'tag', 'release', 1);
  });

  it('uses defaults (post/tag) when config is absent', async () => {
    routeQuery.value = { tag: 'tutorial' };
    mountArchive();
    await flushPromises();

    expect(byTermMock).toHaveBeenCalledWith('post', 'tag', 'tutorial', 1);
  });

  it('does NOT fetch and shows the prompt when ?tag= is absent', async () => {
    routeQuery.value = {};
    const wrapper = mountArchive({});
    await flushPromises();

    expect(byTermMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="tag-archive-prompt"]').exists()).toBe(true);
  });

  it('renders results through PostList', async () => {
    routeQuery.value = { tag: 'release' };
    itemsRef.value = [
      { id: '1', type: 'post', slug: 'a', title: 'A', excerpt: 'ea', published_at: null, og_image_url: null },
      { id: '2', type: 'post', slug: 'b', title: 'B', excerpt: 'eb', published_at: null, og_image_url: null },
    ];
    const wrapper = mountArchive({ mode: 'excerpt' });
    await flushPromises();

    expect(wrapper.findAll('[data-testid="post-card"]')).toHaveLength(2);
  });

  it('shows the empty state when the tag has no posts', async () => {
    routeQuery.value = { tag: 'nomatch' };
    itemsRef.value = [];
    const wrapper = mountArchive({});
    await flushPromises();

    expect(wrapper.find('[data-testid="tag-archive-empty"]').exists()).toBe(true);
  });

  it('re-fetches when ?tag= changes', async () => {
    routeQuery.value = { tag: 'first' };
    mountArchive({ type: 'post' });
    await flushPromises();
    expect(byTermMock).toHaveBeenCalledTimes(1);

    routeQuery.value = { tag: 'second' };
    await flushPromises();

    expect(byTermMock).toHaveBeenCalledTimes(2);
    expect(byTermMock).toHaveBeenLastCalledWith('post', 'tag', 'second', 1);
  });
});
