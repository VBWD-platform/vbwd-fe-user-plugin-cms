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

  it('titles mode renders the flat structure (no category two-column wrapper)', () => {
    const wrapper = mountCard(makePost(), { mode: 'titles' });
    expect(wrapper.classes()).toContain('post-card--titles');
    expect(wrapper.find('.post-card__content').exists()).toBe(false);
    expect(wrapper.find('.post-card__eyebrow').exists()).toBe(false);
    expect(wrapper.find('.post-card__thumb').exists()).toBe(false);
  });
});

describe('PostCard — category (WordPress-archive) mode', () => {
  it('renders the post-card--category two-column layout with eyebrow, date and excerpt', () => {
    const wrapper = mountCard(
      makePost({
        primary_category: { name: 'News' },
        published_at: '2026-06-01T10:00:00+00:00',
        excerpt_effective: 'Curated summary.',
        excerpt: 'Raw excerpt.',
      }),
      { mode: 'category' },
    );

    expect(wrapper.classes()).toContain('post-card--category');
    expect(wrapper.find('.post-card__content').exists()).toBe(true);

    const eyebrow = wrapper.find('[data-testid="post-category"]');
    expect(eyebrow.exists()).toBe(true);
    expect(eyebrow.text()).toBe('News');

    const time = wrapper.find('.post-card__meta-item--date');
    expect(time.exists()).toBe(true);
    expect(time.element.tagName.toLowerCase()).toBe('time');
    expect(time.text()).toMatch(/2026/);

    // excerpt_effective is preferred over the raw excerpt.
    const excerpt = wrapper.find('.post-card__excerpt');
    expect(excerpt.exists()).toBe(true);
    expect(excerpt.text()).toBe('Curated summary.');
  });

  it('links the category eyebrow to the archive_url from serialization', () => {
    const wrapper = mountCard(
      makePost({
        primary_category: { name: 'News', slug: 'news', archive_url: 'category/news' },
      }),
      { mode: 'category' },
    );
    const eyebrow = wrapper.findComponent(RouterLinkStub);
    // The FIRST router-link in category mode is the eyebrow.
    expect(eyebrow.props('to')).toBe('/category/news');
  });

  it('derives the category archive path from slug when archive_url is absent', () => {
    const wrapper = mountCard(
      makePost({ primary_category: { name: 'News', slug: 'news' } }),
      { mode: 'category' },
    );
    const eyebrow = wrapper.find('[data-testid="post-category"]');
    expect(eyebrow.exists()).toBe(true);
    // RouterLinkStub renders `to` on the anchor's props; assert via the link.
    const link = wrapper.findAllComponents(RouterLinkStub)[0];
    expect(link.props('to')).toBe('/category/news');
  });

  it('falls back to excerpt when excerpt_effective is absent', () => {
    const wrapper = mountCard(
      makePost({ excerpt_effective: undefined, excerpt: 'Raw excerpt.' }),
      { mode: 'category' },
    );
    expect(wrapper.find('.post-card__excerpt').text()).toBe('Raw excerpt.');
  });

  it('renders a thumbnail from featured_image_url when present', () => {
    const wrapper = mountCard(
      makePost({ featured_image_url: 'https://cdn/feat.avif', og_image_url: null }),
      { mode: 'category' },
    );
    const thumb = wrapper.find('.post-card__thumb');
    expect(thumb.exists()).toBe(true);
    expect(thumb.find('img').exists()).toBe(true);
  });

  it('falls back to og_image_url for the thumbnail when featured_image_url is absent', () => {
    const wrapper = mountCard(
      makePost({ featured_image_url: undefined, og_image_url: 'https://cdn/og.avif' }),
      { mode: 'category' },
    );
    const thumb = wrapper.find('.post-card__thumb');
    expect(thumb.exists()).toBe(true);
    expect(thumb.find('img').exists()).toBe(true);
  });

  it('renders NO thumbnail element when neither image source is present', () => {
    const wrapper = mountCard(
      makePost({ featured_image_url: undefined, og_image_url: null }),
      { mode: 'category' },
    );
    expect(wrapper.find('.post-card__thumb').exists()).toBe(false);
  });

  it('omits the eyebrow when primary_category is null', () => {
    const wrapper = mountCard(
      makePost({ primary_category: null }),
      { mode: 'category' },
    );
    expect(wrapper.find('[data-testid="post-category"]').exists()).toBe(false);
    expect(wrapper.find('.post-card__eyebrow').exists()).toBe(false);
  });

  it('omits the date when published_at is null', () => {
    const wrapper = mountCard(
      makePost({ published_at: null }),
      { mode: 'category' },
    );
    expect(wrapper.find('.post-card__meta-item--date').exists()).toBe(false);
  });
});

describe('PostCard — post/page type badge (category mode)', () => {
  it('renders a page badge with the --page modifier and "Page" label for type=page', () => {
    const wrapper = mountCard(makePost({ type: 'page' }), { mode: 'category' });
    const badge = wrapper.find('[data-testid="post-type-badge"]');
    expect(badge.exists()).toBe(true);
    expect(badge.classes()).toContain('post-card__badge--page');
    expect(badge.text()).toBe('Page');
  });

  it('renders a post badge with the --post modifier and "Post" label for type=post', () => {
    const wrapper = mountCard(makePost({ type: 'post' }), { mode: 'category' });
    const badge = wrapper.find('[data-testid="post-type-badge"]');
    expect(badge.exists()).toBe(true);
    expect(badge.classes()).toContain('post-card__badge--post');
    expect(badge.text()).toBe('Post');
  });

  it('falls back to the --post badge for a custom non-page type, title-cased', () => {
    const wrapper = mountCard(makePost({ type: 'ghrm' }), { mode: 'category' });
    const badge = wrapper.find('[data-testid="post-type-badge"]');
    expect(badge.exists()).toBe(true);
    expect(badge.classes()).toContain('post-card__badge--post');
    expect(badge.text()).toBe('Ghrm');
  });

  it('does NOT render the badge outside category mode', () => {
    const wrapper = mountCard(makePost({ type: 'page' }), { mode: 'titles' });
    expect(wrapper.find('[data-testid="post-type-badge"]').exists()).toBe(false);
  });
});
