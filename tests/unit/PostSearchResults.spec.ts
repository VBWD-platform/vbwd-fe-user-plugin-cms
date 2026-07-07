import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, RouterLinkStub, flushPromises, type VueWrapper } from '@vue/test-utils';
import { ref } from 'vue';

const bySearchMock = vi.fn();
const itemsRef = { value: [] as unknown[] };
const loadingRef = { value: false };
const routeQuery = ref<Record<string, unknown>>({});

vi.mock('vue-router', () => ({
  useRoute: () => ({ get query() { return routeQuery.value; } }),
}));

vi.mock('../../src/composables/usePosts', () => ({
  usePosts: () => ({
    bySearch: bySearchMock,
    items: itemsRef,
    loading: loadingRef,
    page: { value: 1 },
    pages: { value: 1 },
    total: { value: itemsRef.value.length },
  }),
}));

import PostSearchResults from '../../src/components/PostSearchResults.vue';

const mountedWrappers: VueWrapper[] = [];

function mountResults(config: Record<string, unknown> = {}) {
  const wrapper = mount(PostSearchResults, {
    props: { config },
    global: {
      stubs: { RouterLink: RouterLinkStub },
      mocks: { $t: (_key: string, fallback?: string) => fallback ?? _key },
    },
  });
  mountedWrappers.push(wrapper);
  return wrapper;
}

describe('PostSearchResults (search-results widget)', () => {
  beforeEach(() => {
    bySearchMock.mockReset();
    bySearchMock.mockResolvedValue(undefined);
    itemsRef.value = [];
    loadingRef.value = false;
    routeQuery.value = {};
  });

  afterEach(() => {
    // Unmount so prior instances' watch(query) don't react to the shared
    // routeQuery ref mutated by later tests.
    while (mountedWrappers.length) mountedWrappers.pop()?.unmount();
  });

  it('reads ?q= from the URL and calls bySearch on mount', async () => {
    routeQuery.value = { q: 'hospitality' };
    mountResults({ type: 'post', per_page: 12 });
    await flushPromises();

    expect(bySearchMock).toHaveBeenCalledWith('hospitality', 1, {
      type: 'post',
      termType: undefined,
      termSlug: undefined,
    });
  });

  it('forwards scope_term_type / scope_term_slug from config', async () => {
    routeQuery.value = { q: 'news' };
    mountResults({
      type: 'post',
      scope_term_type: 'category',
      scope_term_slug: 'press',
    });
    await flushPromises();

    expect(bySearchMock).toHaveBeenCalledWith('news', 1, {
      type: 'post',
      termType: 'category',
      termSlug: 'press',
    });
  });

  it('does NOT search and shows the empty-query prompt for a blank ?q=', async () => {
    routeQuery.value = {};
    const wrapper = mountResults({});
    await flushPromises();

    expect(bySearchMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="search-empty-query"]').exists()).toBe(true);
  });

  it('renders results through PostList', async () => {
    routeQuery.value = { q: 'hospitality' };
    itemsRef.value = [
      { id: '1', type: 'post', slug: 'a', title: 'A', excerpt: 'ea', published_at: null, og_image_url: null },
      { id: '2', type: 'post', slug: 'b', title: 'B', excerpt: 'eb', published_at: null, og_image_url: null },
    ];
    const wrapper = mountResults({ mode: 'excerpt' });
    await flushPromises();

    expect(wrapper.findAll('[data-testid="post-card"]')).toHaveLength(2);
  });

  it('shows a no-results message when the query returns nothing', async () => {
    routeQuery.value = { q: 'nomatch' };
    itemsRef.value = [];
    const wrapper = mountResults({});
    await flushPromises();

    expect(wrapper.find('[data-testid="search-no-results"]').exists()).toBe(true);
  });

  it('maps config.scope to the request type (S121): pages→page', async () => {
    routeQuery.value = { q: 'guide' };
    mountResults({ scope: 'pages' });
    await flushPromises();

    expect(bySearchMock).toHaveBeenCalledWith('guide', 1, {
      type: 'page',
      termType: undefined,
      termSlug: undefined,
    });
  });

  it('maps config.scope to the request type (S121): posts→post', async () => {
    routeQuery.value = { q: 'guide' };
    mountResults({ scope: 'posts' });
    await flushPromises();

    expect(bySearchMock).toHaveBeenLastCalledWith('guide', 1, {
      type: 'post',
      termType: undefined,
      termSlug: undefined,
    });
  });

  it('maps config.scope="both" to no type filter (S121)', async () => {
    routeQuery.value = { q: 'guide' };
    mountResults({ scope: 'both' });
    await flushPromises();

    expect(bySearchMock).toHaveBeenLastCalledWith('guide', 1, {
      type: undefined,
      termType: undefined,
      termSlug: undefined,
    });
  });

  it('falls back to the legacy `type` when scope is absent (S121 back-compat)', async () => {
    routeQuery.value = { q: 'guide' };
    mountResults({ type: 'page' });
    await flushPromises();

    expect(bySearchMock).toHaveBeenLastCalledWith('guide', 1, {
      type: 'page',
      termType: undefined,
      termSlug: undefined,
    });
  });

  it('re-searches when ?q= changes (composition across pages via the URL)', async () => {
    routeQuery.value = { q: 'first' };
    mountResults({ type: 'post' });
    await flushPromises();
    expect(bySearchMock).toHaveBeenCalledTimes(1);

    routeQuery.value = { q: 'second' };
    await flushPromises();

    expect(bySearchMock).toHaveBeenCalledTimes(2);
    expect(bySearchMock).toHaveBeenLastCalledWith('second', 1, {
      type: 'post',
      termType: undefined,
      termSlug: undefined,
    });
  });
});
