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

describe('CmsPageTypePost', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('injects the title heading with tags under it — never the excerpt', async () => {
    const wrapper = mountPost(
      makePost({
        terms: [{ id: 't1', term_type: 'tag', slug: 'vue', name: 'Vue' }],
      }),
    );
    await flushPromises();

    const header = headerHtmlOf(wrapper);
    expect(header).toContain('cms-post-title');
    expect(header).toContain('My Great Post');
    expect(header).toContain('cms-post-tags');
    expect(header).toContain('Vue');
    // The title comes before the tags (tags under the heading).
    expect(header.indexOf('cms-post-title')).toBeLessThan(header.indexOf('cms-post-tags'));
    // The excerpt is never injected (the post body keeps its own lead).
    expect(header).not.toContain('cms-post-excerpt');
    expect(header).not.toContain('A short summary of the post.');
  });

  it('renders the title heading even when the post has no tags', async () => {
    const wrapper = mountPost(makePost({ terms: [] }));
    await flushPromises();

    const header = headerHtmlOf(wrapper);
    expect(header).toContain('cms-post-title');
    expect(header).toContain('My Great Post');
    expect(header).not.toContain('cms-post-tags');
  });

  it('renders a chip per tag term, linking to the tag archive (categories excluded)', async () => {
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
    expect(header).toContain('href="/tag?tag=vue"');
    expect(header).toContain('href="/tag?tag=ts"');
    expect(header).toContain('>Vue<');
    expect(header).toContain('>TypeScript<');
    // Category terms never appear in the cloud.
    expect(header).not.toContain('News');
  });

  it('renders no tag chips when the post has only category terms', async () => {
    const wrapper = mountPost(
      makePost({
        terms: [{ id: 'c1', term_type: 'category', slug: 'news', name: 'News' }],
      }),
    );
    await flushPromises();

    const header = headerHtmlOf(wrapper);
    expect(header).toContain('cms-post-title');
    expect(header).not.toContain('cms-post-tags');
    expect(header).not.toContain('News');
  });
});
