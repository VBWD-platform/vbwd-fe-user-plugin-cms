import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, RouterLinkStub, flushPromises } from '@vue/test-utils';

const byTermMock = vi.fn();
const itemsRef = { value: [] as unknown[] };

vi.mock('../../src/composables/usePosts', () => ({
  usePosts: () => ({
    byTerm: byTermMock,
    items: itemsRef,
    loading: { value: false },
    page: { value: 1 },
    pages: { value: 1 },
    total: { value: 0 },
  }),
}));

import PostTermListWidget from '../../src/components/PostTermListWidget.vue';

function mountWidget(config: Record<string, unknown>) {
  return mount(PostTermListWidget, {
    props: { config },
    global: {
      stubs: { RouterLink: RouterLinkStub },
      mocks: { $t: (key: string) => key },
    },
  });
}

const RSS_TYPE = 'application/rss+xml';

function rssAlternateLinks(): HTMLLinkElement[] {
  return Array.from(
    document.head.querySelectorAll<HTMLLinkElement>(
      `link[rel="alternate"][type="${RSS_TYPE}"]`,
    ),
  );
}

describe('PostTermListWidget (Category)', () => {
  beforeEach(() => {
    byTermMock.mockReset();
    byTermMock.mockResolvedValue(undefined);
    itemsRef.value = [];
    document.head.innerHTML = '';
  });

  it('reads config from content_json and calls byTerm with the right args', async () => {
    mountWidget({
      type: 'post',
      term_type: 'category',
      term_slug: 'news',
      mode: 'excerpt',
      meta: ['author', 'time_ago', 'tags'],
      limit: 10,
    });
    await flushPromises();

    expect(byTermMock).toHaveBeenCalledWith('post', 'category', 'news', 1);
  });

  it('renders a PostList of the fetched posts', async () => {
    itemsRef.value = [
      { id: '1', type: 'post', slug: 'a', title: 'A', excerpt: 'ea', published_at: null, og_image_url: null },
      { id: '2', type: 'post', slug: 'b', title: 'B', excerpt: 'eb', published_at: null, og_image_url: null },
    ];
    const wrapper = mountWidget({
      type: 'post',
      term_type: 'category',
      term_slug: 'news',
      mode: 'excerpt',
    });
    await flushPromises();

    expect(wrapper.findAll('[data-testid="post-card"]')).toHaveLength(2);
  });

  it('renders the empty state for a term with no posts (graceful)', async () => {
    itemsRef.value = [];
    const wrapper = mountWidget({
      type: 'post',
      term_type: 'category',
      term_slug: 'empty',
      mode: 'titles',
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="post-list-empty"]').exists()).toBe(true);
  });

  it('does not fetch when term config is incomplete (no crash)', async () => {
    mountWidget({ type: 'post', mode: 'excerpt' });
    await flushPromises();

    expect(byTermMock).not.toHaveBeenCalled();
  });

  it('emits an RSS autodiscovery link for the current term', async () => {
    mountWidget({ type: 'post', term_type: 'category', term_slug: 'news' });
    await flushPromises();

    const hrefs = rssAlternateLinks().map((link) => link.getAttribute('href'));
    expect(hrefs).toContain(
      '/api/v1/cms/rss.xml?type=post&term_type=category&term_slug=news',
    );
  });

  it('renders a visible RSS link to the current term feed', async () => {
    const wrapper = mountWidget({
      type: 'post',
      term_type: 'category',
      term_slug: 'news',
    });
    await flushPromises();

    const link = wrapper.find('[data-testid="post-term-rss-link"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe(
      '/api/v1/cms/rss.xml?type=post&term_type=category&term_slug=news',
    );
  });

  it('emits no RSS autodiscovery link when the term config is incomplete', async () => {
    mountWidget({ type: 'post', mode: 'excerpt' });
    await flushPromises();

    expect(rssAlternateLinks()).toHaveLength(0);
  });
});
