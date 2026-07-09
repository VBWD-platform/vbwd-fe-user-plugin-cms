import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';

vi.mock('@/api', () => ({
  api: { get: vi.fn(async () => ({})) },
  isAuthenticated: () => false,
}));

import CmsPageTypePost from '../../src/views/CmsPageTypePost.vue';
import type { CmsPageItem } from '../../src/stores/useCmsStore';

// Capture the header-html the post type feeds into the shared base scaffold.
const baseStubs = {
  CmsPageTypeBase: {
    props: ['page', 'layout', 'headerHtml'],
    template: '<div class="base-stub" :data-header="headerHtml"></div>',
  },
};

function makePost(overrides: Partial<CmsPageItem> = {}): CmsPageItem {
  return {
    id: 'p-1',
    slug: 'my-post',
    type: 'post',
    title: 'My Great Post',
    excerpt: 'A short summary of the post.',
    language: 'en',
    content_json: {},
    sort_order: 0,
    meta_title: null,
    meta_description: null,
    og_title: null,
    og_description: null,
    og_image_url: null,
    canonical_url: null,
    robots: 'index,follow',
    schema_json: null,
    updated_at: '',
    ...overrides,
  };
}

function mountPost(page: CmsPageItem) {
  return mount(CmsPageTypePost, {
    props: { page, layout: null },
    global: { stubs: baseStubs },
  });
}

function headerHtmlOf(wrapper: ReturnType<typeof mountPost>): string {
  return wrapper.find('.base-stub').attributes('data-header') ?? '';
}

describe('CmsPageTypePost — magazine hero header', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders an image-backed hero when enabled and a featured image is present', async () => {
    const wrapper = mountPost(
      makePost({
        featured_image_url: '/uploads/hero.jpg',
        terms: [{ id: 't1', term_type: 'tag', slug: 'vue', name: 'Vue' }],
      }),
    );
    await flushPromises();

    const header = headerHtmlOf(wrapper);
    // Hero container, not the plain post header.
    expect(header).toContain('cms-post-hero');
    expect(header).toContain('cms-post-hero--image');
    expect(header).not.toContain('cms-post-hero--gradient');
    // The featured image URL is baked into the hero background.
    expect(header).toContain('/uploads/hero.jpg');
    // Title + excerpt are overlaid on the hero.
    expect(header).toContain('cms-post-title');
    expect(header).toContain('My Great Post');
    expect(header).toContain('cms-post-excerpt');
    expect(header).toContain('A short summary of the post.');
    // A scrim/blur contrast layer sits under the title for legibility.
    expect(header).toContain('cms-post-hero__contrast');
    // Tags still render, under the heading.
    expect(header).toContain('cms-post-tags');
    expect(header).toContain('Vue');
  });

  it('renders a gradient-band hero when enabled but no featured image is present', async () => {
    const wrapper = mountPost(makePost({ featured_image_url: null }));
    await flushPromises();

    const header = headerHtmlOf(wrapper);
    expect(header).toContain('cms-post-hero');
    expect(header).toContain('cms-post-hero--gradient');
    expect(header).not.toContain('cms-post-hero--image');
    // No image element and no inline background-image in the gradient case.
    expect(header).not.toContain('<img');
    expect(header).not.toContain('background-image');
    // Title + excerpt still overlaid.
    expect(header).toContain('cms-post-title');
    expect(header).toContain('My Great Post');
    expect(header).toContain('cms-post-excerpt');
    expect(header).toContain('A short summary of the post.');
    // Blur contrast layer under the title present in the gradient case too.
    expect(header).toContain('cms-post-hero__contrast');
  });

  it('defaults the hero ON when show_featured_hero is absent from type_data', async () => {
    const wrapper = mountPost(makePost({ type_data: {} }));
    await flushPromises();

    const header = headerHtmlOf(wrapper);
    expect(header).toContain('cms-post-hero');
  });

  it('keeps the plain title header (no hero) when show_featured_hero === false', async () => {
    const wrapper = mountPost(
      makePost({
        featured_image_url: '/uploads/hero.jpg',
        type_data: { show_featured_hero: false },
        terms: [{ id: 't1', term_type: 'tag', slug: 'vue', name: 'Vue' }],
      }),
    );
    await flushPromises();

    const header = headerHtmlOf(wrapper);
    // The plain, unchanged header — never the hero.
    expect(header).toContain('cms-post-header');
    expect(header).not.toContain('cms-post-hero');
    expect(header).toContain('cms-post-title');
    expect(header).toContain('My Great Post');
    // Plain header carries the tags but never the excerpt or a background image.
    expect(header).toContain('cms-post-tags');
    expect(header).toContain('Vue');
    expect(header).not.toContain('cms-post-excerpt');
    expect(header).not.toContain('/uploads/hero.jpg');
  });

  it('renders a chip per tag term in the hero, linking to the tag archive (categories excluded)', async () => {
    const wrapper = mountPost(
      makePost({
        terms: [
          { id: 'c1', term_type: 'category', slug: 'news', name: 'News' },
          { id: 't1', term_type: 'tag', slug: 'vue', name: 'Vue' },
          { id: 't2', term_type: 'tag', slug: 'ts', name: 'TypeScript' },
        ],
      }),
    );
    await flushPromises();

    const header = headerHtmlOf(wrapper);
    expect(header).toContain('href="/tag/vue"');
    expect(header).toContain('href="/tag/ts"');
    expect(header).toContain('>Vue<');
    expect(header).toContain('>TypeScript<');
    // Category terms never appear in the cloud.
    expect(header).not.toContain('News');
  });
});
