import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const pushMock = vi.fn();
const routeQuery = { value: {} as Record<string, unknown> };

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
  useRoute: () => ({ get query() { return routeQuery.value; }, path: '/search' }),
}));

import PostSearch from '../../src/components/PostSearch.vue';

function mountBox(config: Record<string, unknown> = {}) {
  return mount(PostSearch, {
    props: { config },
    global: { mocks: { $t: (_key: string, fallback?: string) => fallback ?? _key } },
  });
}

describe('PostSearch (search box widget)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pushMock.mockReset();
    routeQuery.value = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the configured placeholder', () => {
    const wrapper = mountBox({ placeholder: 'Find articles…' });
    expect(wrapper.find('input').attributes('placeholder')).toBe('Find articles…');
  });

  it('debounces typing then URL-syncs ?q= on the current path', async () => {
    const wrapper = mountBox({});
    await wrapper.find('input').setValue('hospitality');

    // Not pushed before the debounce window elapses.
    expect(pushMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    await flushPromises();

    expect(pushMock).toHaveBeenCalledWith({
      path: '/search',
      query: { q: 'hospitality' },
    });
  });

  it('navigates to target_path when results live on another page', async () => {
    const wrapper = mountBox({ target_path: '/search' });
    await wrapper.find('input').setValue('news');
    vi.advanceTimersByTime(400);
    await flushPromises();

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
});
