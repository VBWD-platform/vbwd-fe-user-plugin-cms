/**
 * PostCard — archive display toggles (CMS archives Inc 2).
 *
 * Three per-widget booleans control what an archive card shows, each defaulting
 * ON: `show_categories` → the category eyebrow, `show_tags` → tag chips linking
 * `/tag/<slug>`, `show_article_size` → the reading-time meta item. They arrive
 * on the shared `display` object (camelCase: showCategories / showTags /
 * showArticleSize) so every archive widget that renders through PostList →
 * PostCard honours them uniformly (DRY spine).
 *
 * Engineering requirements (binding, restated): TDD-first (this RED set);
 * SOLID (PostCard stays the single render path; the three toggles are the
 * single source of truth for category/tags/reading-time — no competing `meta`
 * mechanism); DRY; clean code; no overengineering. Quality guard:
 * `npm run test` + `npm run lint` + theme-token purity.
 */
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
    // ~400 words → a >1 minute read so reading-time is deterministically shown.
    content_html: `<p>${'word '.repeat(400)}</p>`,
    published_at: '2026-06-01T10:00:00+00:00',
    author_id: 'a1',
    og_image_url: 'https://cdn/img.avif',
    primary_category: { name: 'News', slug: 'news', archive_url: 'category/news' },
    tags: [
      { name: 'AI', slug: 'ai', archive_url: 'tag/ai' },
      { name: 'Machine Learning', slug: 'machine-learning' },
    ],
    ...overrides,
  } as PostSummary;
}

function mountCard(display: Record<string, unknown>, post: PostSummary = makePost()) {
  return mount(PostCard, {
    props: { post, display },
    global: {
      stubs: { RouterLink: RouterLinkStub },
      mocks: { $t: (key: string) => key },
    },
  });
}

const READING_TIME = '.post-card__meta-item--reading_time';

describe('PostCard — archive display toggles', () => {
  it('defaults all three ON: eyebrow, tag chips and reading time all render', () => {
    const wrapper = mountCard({ mode: 'category' });
    expect(wrapper.find('[data-testid="post-category"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="post-tag"]')).toHaveLength(2);
    expect(wrapper.find(READING_TIME).exists()).toBe(true);
  });

  it('hides ONLY the category eyebrow when showCategories is false', () => {
    const wrapper = mountCard({ mode: 'category', showCategories: false });
    expect(wrapper.find('[data-testid="post-category"]').exists()).toBe(false);
    // The other two remain independent.
    expect(wrapper.findAll('[data-testid="post-tag"]')).toHaveLength(2);
    expect(wrapper.find(READING_TIME).exists()).toBe(true);
  });

  it('hides ONLY the tag chips when showTags is false', () => {
    const wrapper = mountCard({ mode: 'category', showTags: false });
    expect(wrapper.find('[data-testid="post-tags"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="post-tag"]')).toHaveLength(0);
    expect(wrapper.find('[data-testid="post-category"]').exists()).toBe(true);
    expect(wrapper.find(READING_TIME).exists()).toBe(true);
  });

  it('hides ONLY the reading time when showArticleSize is false', () => {
    const wrapper = mountCard({ mode: 'category', showArticleSize: false });
    expect(wrapper.find(READING_TIME).exists()).toBe(false);
    expect(wrapper.find('[data-testid="post-category"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="post-tag"]')).toHaveLength(2);
  });

  it('links each tag chip to /tag/<slug>, preferring archive_url then slug', () => {
    const wrapper = mountCard({ mode: 'category' });
    const chips = wrapper.findAllComponents(RouterLinkStub).filter((link) =>
      String(link.props('to')).startsWith('/tag/'),
    );
    expect(chips.map((chip) => chip.props('to'))).toEqual([
      '/tag/ai',
      '/tag/machine-learning',
    ]);
    expect(wrapper.find('[data-testid="post-tag"]').text()).toBe('AI');
  });

  it('renders reading time in excerpt mode too (uniform across modes)', () => {
    const wrapper = mountCard({ mode: 'excerpt' });
    expect(wrapper.find(READING_TIME).exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="post-tag"]')).toHaveLength(2);
  });

  it('renders nothing tag-related when the post has no tags (graceful)', () => {
    const wrapper = mountCard({ mode: 'category' }, makePost({ tags: [] }));
    expect(wrapper.find('[data-testid="post-tags"]').exists()).toBe(false);
  });

  it('does NOT double-render tags via the legacy meta array (single source)', () => {
    // Even when `tags` is passed in meta, the card renders chips (not a comma
    // list) — the boolean is the single source of truth.
    const wrapper = mountCard({ mode: 'category', meta: ['tags'] });
    const commaJoined = wrapper.findAll('.post-card__meta-item--tags');
    expect(commaJoined).toHaveLength(0);
    expect(wrapper.findAll('[data-testid="post-tag"]')).toHaveLength(2);
  });
});
