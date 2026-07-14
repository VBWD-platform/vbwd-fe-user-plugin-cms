/**
 * The CMS store resolves a slug in precedence order: page → post → term
 * archive → PREFIX archive. This spec covers the final prefix-archive fallback:
 * when page, post AND term all 404, the store queries the WordPress-style
 * `GET /cms/archive/<path>` endpoint and, on 200, mounts a synthetic archive
 * page (marked `type: 'archive'`) that lists the returned posts. A full 404
 * (archive also missing) leaves the existing not-found behaviour intact.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const getMock = vi.fn();

vi.mock('@/api', () => ({
  api: { get: (...args: unknown[]) => getMock(...args) },
  isAuthenticated: () => false,
}));

// The store fetches the default style CSS via the global `fetch`; stub it so the
// archive branch resolves without a real network call.
const fetchMock = vi.fn(async () => ({ ok: true, text: async () => '.x{}' }));
vi.stubGlobal('fetch', fetchMock);

import { useCmsStore } from '../../src/stores/useCmsStore';

function notFound() {
  return { response: { status: 404 } };
}

describe('useCmsStore — prefix-archive fallback (page → post → term → archive)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getMock.mockReset();
    fetchMock.mockClear();
  });

  it('resolves /blog/2026 to a prefix archive after page, post AND term all miss', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === '/cms/posts/blog/2026') throw notFound(); // page + post retry 404
      if (url === '/cms/archive/blog/2026') {
        return {
          prefix: 'blog/2026',
          title: '2026',
          items: [
            { id: 'p1', type: 'post', slug: 'blog/2026/news/a', title: 'A' },
            { id: 'p2', type: 'post', slug: 'blog/2026/news/b', title: 'B' },
          ],
          total: 2,
          page: 1,
          per_page: 20,
          pages: 1,
        };
      }
      if (url === '/cms/layouts/by-slug/terms-archive') {
        return { id: 'L-TA', slug: 'terms-archive', name: 'Term Archive', areas: [], assignments: [] };
      }
      if (String(url).startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    const store = useCmsStore();
    await store.fetchPage('blog/2026');

    expect(store.currentPage).not.toBeNull();
    expect(store.currentPage?.type).toBe('archive');
    expect(store.currentPage?.archive_prefix).toBe('blog/2026');
    expect(store.currentPage?.title).toBe('2026');
    expect(store.currentPage?.items).toHaveLength(2);
    expect(store.currentLayout?.slug).toBe('terms-archive');

    // `blog/2026` is not a category/tag path, so the term endpoint is skipped.
    const calledUrls = getMock.mock.calls.map((call) => call[0]);
    expect(calledUrls.some((u) => String(u).startsWith('/cms/terms/'))).toBe(false);
    expect(calledUrls).toContain('/cms/archive/blog/2026');
  });

  it('leaves the not-found path unchanged when the archive endpoint also 404s', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === '/cms/posts/blog/ghost') throw notFound();
      if (url === '/cms/archive/blog/ghost') throw notFound();
      if (String(url).startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    const store = useCmsStore();
    await store.fetchPage('blog/ghost');

    expect(store.currentPage).toBeNull();
    expect(store.error).toBeTruthy();
  });
});
