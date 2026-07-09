import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, RouterLinkStub, flushPromises, type VueWrapper } from '@vue/test-utils';
import { ref } from 'vue';

const byTermMock = vi.fn();
const itemsRef = { value: [] as unknown[] };
const loadingRef = { value: false };
const pageRef = { value: 1 };
const pagesRef = { value: 1 };
const routeParams = ref<Record<string, unknown>>({});
const currentPageRef = ref<Record<string, unknown> | null>(null);

vi.mock('vue-router', () => ({
  useRoute: () => ({ get params() { return routeParams.value; } }),
}));

vi.mock('../../src/composables/usePosts', () => ({
  usePosts: () => ({
    byTerm: byTermMock,
    items: itemsRef,
    loading: loadingRef,
    page: pageRef,
    pages: pagesRef,
    total: { value: itemsRef.value.length },
  }),
}));

vi.mock('../../src/stores/useCmsStore', () => ({
  useCmsStore: () => ({ get currentPage() { return currentPageRef.value; } }),
}));

import TermArchiveWidget from '../../src/components/TermArchiveWidget.vue';

const mountedWrappers: VueWrapper[] = [];

function mountWidget(config: Record<string, unknown> = {}) {
  const wrapper = mount(TermArchiveWidget, {
    props: { config },
    global: {
      stubs: { RouterLink: RouterLinkStub },
      mocks: { $t: (_key: string, fallback?: string) => fallback ?? _key },
    },
  });
  mountedWrappers.push(wrapper);
  return wrapper;
}

describe('TermArchiveWidget (shared route-driven term archive)', () => {
  beforeEach(() => {
    byTermMock.mockReset();
    byTermMock.mockResolvedValue(undefined);
    itemsRef.value = [];
    loadingRef.value = false;
    pageRef.value = 1;
    pagesRef.value = 1;
    routeParams.value = {};
    currentPageRef.value = null;
  });

  afterEach(() => {
    while (mountedWrappers.length) mountedWrappers.pop()?.unmount();
  });

  it('reads a /category/<slug> route and calls byTerm with the category args', async () => {
    routeParams.value = { slug: 'category/gadgets' };
    mountWidget({ type: 'post', posts_per_page: 12 });
    await flushPromises();

    expect(byTermMock).toHaveBeenCalledWith('post', 'category', 'gadgets', 1);
  });

  it('reads a /tag/<slug> route and calls byTerm with the tag args', async () => {
    routeParams.value = { slug: 'tag/vue' };
    mountWidget();
    await flushPromises();

    expect(byTermMock).toHaveBeenCalledWith('post', 'tag', 'vue', 1);
  });

  it('renders the resolved term name from the store context as the heading', async () => {
    routeParams.value = { slug: 'category/gadgets' };
    currentPageRef.value = {
      term_archive: { term_type: 'category', slug: 'gadgets', name: 'Gadgets', description: 'Shiny things' },
    };
    const wrapper = mountWidget();
    await flushPromises();

    expect(wrapper.find('[data-testid="term-archive-heading"]').text()).toBe('Gadgets');
    expect(wrapper.find('[data-testid="term-archive-description"]').text()).toBe('Shiny things');
  });

  it('title-cases the slug as a fallback heading when no store context matches', async () => {
    routeParams.value = { slug: 'category/new-arrivals' };
    const wrapper = mountWidget();
    await flushPromises();

    expect(wrapper.find('[data-testid="term-archive-heading"]').text()).toBe('New Arrivals');
  });

  it('renders results through PostList', async () => {
    routeParams.value = { slug: 'category/gadgets' };
    itemsRef.value = [
      { id: '1', type: 'post', slug: 'a', title: 'A', excerpt: 'ea', published_at: null, og_image_url: null },
      { id: '2', type: 'post', slug: 'b', title: 'B', excerpt: 'eb', published_at: null, og_image_url: null },
    ];
    const wrapper = mountWidget();
    await flushPromises();

    expect(wrapper.findAll('[data-testid="post-card"]')).toHaveLength(2);
  });

  it('shows the category empty state when the category has no posts', async () => {
    routeParams.value = { slug: 'category/gadgets' };
    itemsRef.value = [];
    const wrapper = mountWidget();
    await flushPromises();

    const empty = wrapper.find('[data-testid="term-archive-empty"]');
    expect(empty.exists()).toBe(true);
    expect(empty.text()).toContain('category');
  });

  it('shows the tag empty state when the tag has no posts', async () => {
    routeParams.value = { slug: 'tag/vue' };
    itemsRef.value = [];
    const wrapper = mountWidget();
    await flushPromises();

    const empty = wrapper.find('[data-testid="term-archive-empty"]');
    expect(empty.exists()).toBe(true);
    expect(empty.text()).toContain('tag');
  });

  it('re-fetches when the route term slug changes', async () => {
    routeParams.value = { slug: 'category/first' };
    mountWidget();
    await flushPromises();
    expect(byTermMock).toHaveBeenCalledTimes(1);

    routeParams.value = { slug: 'category/second' };
    await flushPromises();

    expect(byTermMock).toHaveBeenCalledTimes(2);
    expect(byTermMock).toHaveBeenLastCalledWith('post', 'category', 'second', 1);
  });

  it('does NOT fetch and shows the prompt for a non-term route', async () => {
    routeParams.value = { slug: 'about/team' };
    const wrapper = mountWidget();
    await flushPromises();

    expect(byTermMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="term-archive-prompt"]').exists()).toBe(true);
  });
});
