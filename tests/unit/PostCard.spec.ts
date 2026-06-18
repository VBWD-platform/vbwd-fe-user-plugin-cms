import { describe, it, expect } from 'vitest';
import { mount, RouterLinkStub } from '@vue/test-utils';
import PostCard from '../../src/components/PostCard.vue';
import type { PostSummary } from '../../src/composables/usePosts';

function makePost(overrides: Partial<PostSummary> = {}): PostSummary {
  return {
    id: '1',
    type: 'post',
    slug: 'hello-world',
    title: 'Hello World',
    excerpt: 'A short excerpt.',
    content_html: '<p>Body</p>',
    published_at: '2026-06-01T10:00:00+00:00',
    author_id: 'a1',
    og_image_url: 'https://cdn/img.avif',
    ...overrides,
  } as PostSummary;
}

function mountCard(post: PostSummary, display: Record<string, unknown> = {}) {
  return mount(PostCard, {
    props: { post, display },
    global: {
      stubs: { RouterLink: RouterLinkStub },
      mocks: { $t: (key: string) => key },
    },
  });
}

describe('PostCard', () => {
  it('renders the title as a link to the post detail', () => {
    const wrapper = mountCard(makePost());
    const link = wrapper.findComponent(RouterLinkStub);
    expect(link.exists()).toBe(true);
    expect(link.props('to')).toBe('/hello-world');
    expect(wrapper.text()).toContain('Hello World');
  });

  it('builds the embed detail path from detailBase when supplied', () => {
    const wrapper = mount(PostCard, {
      props: { post: makePost(), display: {}, detailBase: '/cms/embed/post/post/' },
      global: {
        stubs: { RouterLink: RouterLinkStub },
        mocks: { $t: (key: string) => key },
      },
    });
    const link = wrapper.findComponent(RouterLinkStub);
    expect(link.props('to')).toBe('/cms/embed/post/post/hello-world');
  });

  it('keeps the bare /:slug detail path when no detailBase is supplied (back-compat)', () => {
    const wrapper = mountCard(makePost());
    const link = wrapper.findComponent(RouterLinkStub);
    expect(link.props('to')).toBe('/hello-world');
  });

  it('renders the lead image lazily with explicit width/height (no CLS)', () => {
    const wrapper = mountCard(
      makePost({ og_image_url: 'https://cdn/img.avif' }),
      { mode: 'excerpt' },
    );
    const img = wrapper.find('img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('loading')).toBe('lazy');
    expect(img.attributes('width')).toBeTruthy();
    expect(img.attributes('height')).toBeTruthy();
  });

  it('shows the excerpt in excerpt mode and hides it in titles mode', () => {
    const withExcerpt = mountCard(makePost(), { mode: 'excerpt' });
    expect(withExcerpt.text()).toContain('A short excerpt.');

    const titlesOnly = mountCard(makePost(), { mode: 'titles' });
    expect(titlesOnly.text()).not.toContain('A short excerpt.');
  });

  it('renders a relative time-ago for published_at when time_ago meta is configured', () => {
    const wrapper = mountCard(
      makePost({ published_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }),
      { mode: 'excerpt', meta: ['time_ago'] },
    );
    const meta = wrapper.find('[data-testid="post-meta"]');
    expect(meta.exists()).toBe(true);
    expect(meta.text().toLowerCase()).toMatch(/hour|ago/);
  });
});
