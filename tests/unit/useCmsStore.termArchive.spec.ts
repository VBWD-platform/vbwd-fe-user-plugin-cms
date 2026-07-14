import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const getMock = vi.fn();

vi.mock('@/api', () => ({
  api: { get: (...args: unknown[]) => getMock(...args) },
  isAuthenticated: () => false,
}));

// The store fetches the default style CSS via the global `fetch`; stub it so the
// term-archive branch resolves without a real network call.
const fetchMock = vi.fn(async () => ({ ok: true, text: async () => '.x{}' }));
vi.stubGlobal('fetch', fetchMock);

import { useCmsStore } from '../../src/stores/useCmsStore';

/** A 404 the store's axios-style error handling recognises. */
function notFound() {
  return { response: { status: 404 } };
}

describe('useCmsStore — catch-all term-archive resolution (page → post → term)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getMock.mockReset();
    fetchMock.mockClear();
  });

  it('resolves /category/<slug> to a term archive ONLY after page AND post 404', async () => {
    getMock.mockImplementation(async (url: string, config?: any) => {
      if (url === '/cms/posts/category/gadgets') {
        // Both the default (page) and the retried post lookups 404.
        throw notFound();
      }
      if (url === '/cms/terms/category/gadgets') {
        return {
          term_type: 'category',
          slug: 'gadgets',
          name: 'Gadgets',
          description: 'Shiny things',
          archive_url: 'category/gadgets',
        };
      }
      if (url === '/cms/layouts/by-slug/terms-archive') {
        return { id: 'L-TA', slug: 'terms-archive', name: 'Term Archive', areas: [], assignments: [] };
      }
      if (String(url).startsWith('/cms/categories')) return { items: [] };
      return {};
      void config;
    });

    const store = useCmsStore();
    await store.fetchPage('category/gadgets');

    // The synthetic term-archive page is mounted, bound to the shared layout.
    expect(store.currentPage).not.toBeNull();
    expect(store.currentPage?.term_archive).toEqual({
      term_type: 'category',
      slug: 'gadgets',
      name: 'Gadgets',
      description: 'Shiny things',
    });
    expect(store.currentPage?.title).toBe('Gadgets');
    expect(store.currentLayout?.slug).toBe('terms-archive');

    // Precedence: the post lookup was attempted BEFORE the term lookup.
    const calledUrls = getMock.mock.calls.map((call) => call[0]);
    const postIdx = calledUrls.indexOf('/cms/posts/category/gadgets');
    const termIdx = calledUrls.indexOf('/cms/terms/category/gadgets');
    expect(postIdx).toBeGreaterThanOrEqual(0);
    expect(termIdx).toBeGreaterThan(postIdx);
  });

  it('resolves /tag/<slug> to a term archive via the tag term endpoint', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === '/cms/posts/tag/vue') throw notFound();
      if (url === '/cms/terms/tag/vue') {
        return { term_type: 'tag', slug: 'vue', name: 'Vue', archive_url: 'tag/vue' };
      }
      if (url === '/cms/layouts/by-slug/terms-archive') {
        return { id: 'L-TA', slug: 'terms-archive', areas: [], assignments: [] };
      }
      if (String(url).startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    const store = useCmsStore();
    await store.fetchPage('tag/vue');

    expect(store.currentPage?.term_archive?.term_type).toBe('tag');
    expect(store.currentLayout?.slug).toBe('terms-archive');
  });

  it('an EXISTING page slug resolves as a page — the term branch is NOT taken', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === '/cms/posts/category/backend') {
        return {
          id: 'p-backend',
          type: 'page',
          slug: 'category/backend',
          title: 'Backend',
          content_json: {},
          layout_id: null,
          style_id: null,
        };
      }
      if (String(url).startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    const store = useCmsStore();
    await store.fetchPage('category/backend');

    expect(store.currentPage?.title).toBe('Backend');
    expect(store.currentPage?.term_archive).toBeUndefined();

    // The term-resolution endpoint must never have been hit.
    const calledUrls = getMock.mock.calls.map((call) => call[0]);
    expect(calledUrls).not.toContain('/cms/terms/category/backend');
  });

  it('falls through to not-found when page, post AND term all 404', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === '/cms/posts/category/ghost') throw notFound();
      if (url === '/cms/terms/category/ghost') throw notFound();
      // The final prefix-archive fallback also misses for a ghost slug.
      if (String(url).startsWith('/cms/archive/')) throw notFound();
      if (String(url).startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    const store = useCmsStore();
    await store.fetchPage('category/ghost');

    expect(store.currentPage).toBeNull();
    expect(store.error).toBeTruthy();
  });

  it('a non-term slug that 404s never attempts term resolution', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === '/cms/posts/about/team') throw notFound();
      // The prefix-archive fallback also misses (no posts under `about/team/`).
      if (String(url).startsWith('/cms/archive/')) throw notFound();
      if (String(url).startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    const store = useCmsStore();
    await store.fetchPage('about/team');

    const calledUrls = getMock.mock.calls.map((call) => call[0]);
    expect(calledUrls.some((u) => String(u).startsWith('/cms/terms/'))).toBe(false);
    expect(store.currentPage).toBeNull();
  });

  describe('prefetch skips term-archive slugs (no dead 404s for tag/category pills)', () => {
    it('prefetchPage makes NO post request for a tag/ or category/ slug', async () => {
      // Every tag pill on a post is an <a href="/tag/x"> the link-prefetcher
      // warms. A tag is never a post, so resolving it as one only ever fired
      // two dead 404s (/cms/posts/tag/x and ?type=post). Prefetch must skip it.
      getMock.mockImplementation(async () => {
        throw new Error('prefetch must not call the API for a term-archive slug');
      });

      const store = useCmsStore();
      await store.prefetchPage('tag/gdpr');
      await store.prefetchPage('category/backend');

      expect(getMock).not.toHaveBeenCalled();
    });

    it('leaves a term slug uncached so a real click still resolves it', async () => {
      getMock.mockImplementation(async () => {
        throw new Error('prefetch must not call the API for a term-archive slug');
      });

      const store = useCmsStore();
      await store.prefetchPage('tag/gdpr');

      // No negative cache entry: the slug is absent, so fetchPage on click will
      // run the normal page → post → term resolution rather than a cached miss.
      expect('tag/gdpr' in store.pageCache).toBe(false);
    });

    it('still prefetches a normal post slug (regression guard)', async () => {
      getMock.mockImplementation(async (url: string) => {
        if (url === '/cms/posts/blog/2026/hello') {
          return { id: 'p1', type: 'post', slug: 'blog/2026/hello', title: 'Hello',
            content_json: {}, layout_id: null, style_id: null };
        }
        return {};
      });

      const store = useCmsStore();
      await store.prefetchPage('blog/2026/hello');

      expect(getMock).toHaveBeenCalledWith('/cms/posts/blog/2026/hello', undefined);
      expect(store.pageCache['blog/2026/hello']?.page?.title).toBe('Hello');
    });
  });
});
