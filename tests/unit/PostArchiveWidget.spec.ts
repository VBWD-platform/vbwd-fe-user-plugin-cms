import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, RouterLinkStub, flushPromises } from '@vue/test-utils';

const byTypeMock = vi.fn();
const itemsRef = { value: [] as unknown[] };
const pageRef = { value: 1 };
const pagesRef = { value: 1 };

vi.mock('../../src/composables/usePosts', () => ({
  usePosts: () => ({
    byType: byTypeMock,
    items: itemsRef,
    loading: { value: false },
    page: pageRef,
    pages: pagesRef,
    total: { value: 0 },
  }),
}));

import PostArchiveWidget from '../../src/components/PostArchiveWidget.vue';

function mountWidget(config: Record<string, unknown>) {
  return mount(PostArchiveWidget, {
    props: { config },
    global: {
      stubs: { RouterLink: RouterLinkStub },
      mocks: { $t: (_key: string, fallback?: string) => fallback ?? _key },
    },
  });
}

describe('PostArchiveWidget (PostArchive)', () => {
  beforeEach(() => {
    byTypeMock.mockReset();
    byTypeMock.mockResolvedValue(undefined);
    itemsRef.value = [];
    pageRef.value = 1;
    pagesRef.value = 1;
  });

  it('fetches all posts of the configured type via byType — no term params', async () => {
    mountWidget({ type: 'post', mode: 'excerpt', posts_per_page: 12 });
    await flushPromises();

    expect(byTypeMock).toHaveBeenCalledWith('post', 1);
  });

  it('defaults to type=post when no type is configured', async () => {
    mountWidget({ mode: 'excerpt' });
    await flushPromises();

    expect(byTypeMock).toHaveBeenCalledWith('post', 1);
  });

  it('renders the fetched posts through PostList', async () => {
    itemsRef.value = [
      { id: '1', type: 'post', slug: 'a', title: 'A', excerpt: 'ea', published_at: null, og_image_url: null },
      { id: '2', type: 'post', slug: 'b', title: 'B', excerpt: 'eb', published_at: null, og_image_url: null },
    ];
    const wrapper = mountWidget({ type: 'post', mode: 'excerpt' });
    await flushPromises();

    expect(wrapper.findAll('[data-testid="post-card"]')).toHaveLength(2);
  });

  it('defaults to the category display (excerpt card WITH featured-image thumbnail)', async () => {
    itemsRef.value = [
      { id: '1', type: 'post', slug: 'a', title: 'A', excerpt: 'ea', published_at: null, og_image_url: null },
    ];
    // No `mode` in config → the widget must fall back to `category`, the only
    // PostCard mode that renders the thumbnail.
    const wrapper = mountWidget({ type: 'post' });
    await flushPromises();

    expect(wrapper.find('[data-testid="post-card"]').classes()).toContain('post-card--category');
  });

  it('shows the empty state when there are zero posts', async () => {
    itemsRef.value = [];
    const wrapper = mountWidget({ type: 'post', mode: 'excerpt' });
    await flushPromises();

    expect(wrapper.find('[data-testid="post-list-empty"]').exists()).toBe(true);
  });

  it('renders pagination and navigates pages when there is more than one', async () => {
    pagesRef.value = 3;
    pageRef.value = 1;
    const wrapper = mountWidget({ type: 'post', mode: 'excerpt', paginate: true });
    await flushPromises();
    byTypeMock.mockClear();

    const next = wrapper.find('[data-testid="post-archive-next"]');
    expect(next.exists()).toBe(true);
    await next.trigger('click');

    expect(byTypeMock).toHaveBeenCalledWith('post', 2);
  });

  it('hides pagination when there is only a single page', async () => {
    pagesRef.value = 1;
    const wrapper = mountWidget({ type: 'post', mode: 'excerpt', paginate: true });
    await flushPromises();

    expect(wrapper.find('[data-testid="post-archive-next"]').exists()).toBe(false);
  });
});
