import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const pushMock = vi.fn();
const routeQuery = { value: {} as Record<string, unknown> };

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
  useRoute: () => ({ get query() { return routeQuery.value; }, path: '/search' }),
}));

// Quicksearch reuses usePosts.bySearch — the SAME API path as SearchResults.
const bySearchMock = vi.fn();
vi.mock('../../src/composables/usePosts', () => ({
  usePosts: () => ({
    bySearch: bySearchMock,
    items: { value: [] },
    current: { value: null },
    loading: { value: false },
    page: { value: 1 },
    pages: { value: 1 },
    total: { value: 0 },
  }),
}));

import PostSearch from '../../src/components/PostSearch.vue';

function mountBox(config: Record<string, unknown> = {}) {
  return mount(PostSearch, {
    props: { config },
    attachTo: document.body,
    global: { mocks: { $t: (_key: string, fallback?: string) => fallback ?? _key } },
  });
}

function pageResult(items: Array<Record<string, unknown>>) {
  return { items, total: items.length, page: 1, per_page: items.length, pages: 1 };
}

describe('PostSearch (search box widget)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pushMock.mockReset();
    bySearchMock.mockReset();
    bySearchMock.mockResolvedValue(pageResult([]));
    routeQuery.value = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Regression: quicksearch OFF (default) must be byte-identical to S47.4.
  // ---------------------------------------------------------------------------
  it('renders the configured placeholder', () => {
    const wrapper = mountBox({ placeholder: 'Find articles…' });
    expect(wrapper.find('input').attributes('placeholder')).toBe('Find articles…');
  });

  it('debounces typing then URL-syncs ?q= on the current path', async () => {
    const wrapper = mountBox({});
    await wrapper.find('input').setValue('hospitality');

    // Not pushed before the debounce window elapses.
    expect(pushMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(400);

    expect(pushMock).toHaveBeenCalledWith({
      path: '/search',
      query: { q: 'hospitality' },
    });
  });

  it('navigates to target_path when results live on another page', async () => {
    const wrapper = mountBox({ target_path: '/search' });
    await wrapper.find('input').setValue('news');
    await vi.advanceTimersByTimeAsync(400);

    expect(pushMock).toHaveBeenCalledWith({
      path: '/search',
      query: { q: 'news' },
    });
  });

  it('submitting the form syncs immediately (no debounce wait)', async () => {
    const wrapper = mountBox({ target_path: '/search' });
    await wrapper.find('input').setValue('staffing');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(pushMock).toHaveBeenCalledWith({
      path: '/search',
      query: { q: 'staffing' },
    });
  });

  it('seeds the input from an existing ?q= in the URL', () => {
    routeQuery.value = { q: 'preexisting' };
    const wrapper = mountBox({});
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('preexisting');
  });

  it('does NOT fetch quicksearch results when quicksearch is off (regression guard)', async () => {
    const wrapper = mountBox({});
    await wrapper.find('input').setValue('anything');
    await vi.advanceTimersByTimeAsync(400);

    expect(bySearchMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="post-search-dropdown"]').exists()).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // S121 — quicksearch ON.
  // ---------------------------------------------------------------------------
  it('fetches with the scope→type mapping and renders a dropdown when enabled', async () => {
    bySearchMock.mockResolvedValue(pageResult([
      { id: '1', slug: 'alpha', title: 'Alpha' },
      { id: '2', slug: 'beta', title: 'Beta' },
    ]));
    const wrapper = mountBox({ quicksearch: true, scope: 'pages' });
    await wrapper.find('input').setValue('doc');
    await vi.advanceTimersByTimeAsync(400);

    expect(bySearchMock).toHaveBeenCalledWith('doc', 1, { type: 'page' });
    expect(wrapper.find('[data-testid="post-search-dropdown"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="post-search-option"]')).toHaveLength(2);
    // Quicksearch does not URL-sync while typing — it answers inline.
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('maps scope=posts→type=post and scope=both→no type filter', async () => {
    const postsWrapper = mountBox({ quicksearch: true, scope: 'posts' });
    await postsWrapper.find('input').setValue('x');
    await vi.advanceTimersByTimeAsync(400);
    expect(bySearchMock).toHaveBeenLastCalledWith('x', 1, { type: 'post' });

    bySearchMock.mockClear();
    const bothWrapper = mountBox({ quicksearch: true, scope: 'both' });
    await bothWrapper.find('input').setValue('y');
    await vi.advanceTimersByTimeAsync(400);
    expect(bySearchMock).toHaveBeenLastCalledWith('y', 1, { type: undefined });
  });

  it('clamps the rendered rows to quicksearch_limit (cap 20)', async () => {
    bySearchMock.mockResolvedValue(pageResult(
      Array.from({ length: 10 }, (_value, index) => ({
        id: String(index),
        slug: `p-${index}`,
        title: `Post ${index}`,
      })),
    ));
    const wrapper = mountBox({ quicksearch: true, quicksearch_limit: 3 });
    await wrapper.find('input').setValue('doc');
    await vi.advanceTimersByTimeAsync(400);

    expect(wrapper.findAll('[data-testid="post-search-option"]')).toHaveLength(3);
  });

  it('does not open a dropdown for an empty / whitespace query', async () => {
    const wrapper = mountBox({ quicksearch: true });
    await wrapper.find('input').setValue('   ');
    await vi.advanceTimersByTimeAsync(400);

    expect(bySearchMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="post-search-dropdown"]').exists()).toBe(false);
  });

  it('ArrowDown then Enter navigates to the active result (router.push)', async () => {
    bySearchMock.mockResolvedValue(pageResult([
      { id: '1', slug: 'alpha', title: 'Alpha' },
      { id: '2', slug: 'beta', title: 'Beta' },
    ]));
    const wrapper = mountBox({ quicksearch: true });
    await wrapper.find('input').setValue('doc');
    await vi.advanceTimersByTimeAsync(400);

    await wrapper.find('input').trigger('keydown', { key: 'ArrowDown' });
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(pushMock).toHaveBeenCalledWith('/alpha');
  });

  it('Enter with no active row keeps the classic ?q= submit', async () => {
    bySearchMock.mockResolvedValue(pageResult([
      { id: '1', slug: 'alpha', title: 'Alpha' },
    ]));
    const wrapper = mountBox({ quicksearch: true, target_path: '/search' });
    await wrapper.find('input').setValue('doc');
    await vi.advanceTimersByTimeAsync(400);

    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(pushMock).toHaveBeenCalledWith({ path: '/search', query: { q: 'doc' } });
  });

  it('clicking a dropdown row navigates to that post', async () => {
    bySearchMock.mockResolvedValue(pageResult([
      { id: '1', slug: 'alpha', title: 'Alpha' },
      { id: '2', slug: 'beta', title: 'Beta' },
    ]));
    const wrapper = mountBox({ quicksearch: true });
    await wrapper.find('input').setValue('doc');
    await vi.advanceTimersByTimeAsync(400);

    await wrapper.findAll('[data-testid="post-search-option"]')[1].trigger('mousedown');
    await flushPromises();

    expect(pushMock).toHaveBeenCalledWith('/beta');
  });

  it('Escape closes the dropdown', async () => {
    bySearchMock.mockResolvedValue(pageResult([
      { id: '1', slug: 'alpha', title: 'Alpha' },
    ]));
    const wrapper = mountBox({ quicksearch: true });
    await wrapper.find('input').setValue('doc');
    await vi.advanceTimersByTimeAsync(400);
    expect(wrapper.find('[data-testid="post-search-dropdown"]').exists()).toBe(true);

    await wrapper.find('input').trigger('keydown', { key: 'Escape' });
    await flushPromises();

    expect(wrapper.find('[data-testid="post-search-dropdown"]').exists()).toBe(false);
  });

  it('a click outside the widget closes the dropdown', async () => {
    bySearchMock.mockResolvedValue(pageResult([
      { id: '1', slug: 'alpha', title: 'Alpha' },
    ]));
    const wrapper = mountBox({ quicksearch: true });
    await wrapper.find('input').setValue('doc');
    await vi.advanceTimersByTimeAsync(400);
    expect(wrapper.find('[data-testid="post-search-dropdown"]').exists()).toBe(true);

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(wrapper.find('[data-testid="post-search-dropdown"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('exposes combobox a11y wiring (role, aria-expanded, aria-controls)', async () => {
    bySearchMock.mockResolvedValue(pageResult([
      { id: '1', slug: 'alpha', title: 'Alpha' },
    ]));
    const wrapper = mountBox({ quicksearch: true });
    const input = wrapper.find('input');
    expect(input.attributes('role')).toBe('combobox');
    expect(input.attributes('aria-expanded')).toBe('false');

    await input.setValue('doc');
    await vi.advanceTimersByTimeAsync(400);

    expect(input.attributes('aria-expanded')).toBe('true');
    const listboxId = wrapper.find('[role="listbox"]').attributes('id');
    expect(input.attributes('aria-controls')).toBe(listboxId);
  });
});
