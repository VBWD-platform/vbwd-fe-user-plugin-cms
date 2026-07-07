import { describe, it, expect, vi, beforeEach } from 'vitest';

const getMock = vi.fn();

vi.mock('@/api', () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
  },
}));

import { usePosts } from '../../src/composables/usePosts';

function paginated(items: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    items,
    total: items.length,
    page: 1,
    per_page: 20,
    pages: 1,
    ...overrides,
  };
}

describe('usePosts', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('byTerm calls the public posts endpoint with type/term filters + page', async () => {
    getMock.mockResolvedValue(paginated([{ id: '1', slug: 'a', title: 'A' }]));
    const posts = usePosts();

    await posts.byTerm('post', 'category', 'news', 2);

    expect(getMock).toHaveBeenCalledWith('/cms/posts', {
      params: {
        type: 'post',
        term_type: 'category',
        term_slug: 'news',
        page: 2,
        per_page: 20,
      },
    });
    expect(posts.items.value).toHaveLength(1);
    expect(posts.page.value).toBe(1);
    expect(posts.loading.value).toBe(false);
  });

  it('byTerm tracks pagination state from the response', async () => {
    getMock.mockResolvedValue(
      paginated([{ id: '1', slug: 'a', title: 'A' }], { page: 3, pages: 5, total: 42 }),
    );
    const posts = usePosts();

    await posts.byTerm('post', 'category', 'news', 3);

    expect(posts.page.value).toBe(3);
    expect(posts.pages.value).toBe(5);
    expect(posts.total.value).toBe(42);
  });

  it('byTerm omits the per_page param at default and exposes a per_page override', async () => {
    getMock.mockResolvedValue(paginated([]));
    const posts = usePosts({ perPage: 6 });

    await posts.byTerm('post', 'category', 'news', 1);

    expect(getMock).toHaveBeenCalledWith('/cms/posts', {
      params: {
        type: 'post',
        term_type: 'category',
        term_slug: 'news',
        page: 1,
        per_page: 6,
      },
    });
  });

  it('byType calls the public posts endpoint with type + page + per_page and NO term params', async () => {
    getMock.mockResolvedValue(paginated([{ id: '1', slug: 'a', title: 'A' }]));
    const posts = usePosts();

    await posts.byType('post', 2);

    expect(getMock).toHaveBeenCalledWith('/cms/posts', {
      params: {
        type: 'post',
        page: 2,
        per_page: 20,
      },
    });
    const [, options] = getMock.mock.calls[0];
    expect(options.params.term_type).toBeUndefined();
    expect(options.params.term_slug).toBeUndefined();
    expect(posts.items.value).toHaveLength(1);
    expect(posts.loading.value).toBe(false);
  });

  it('byType tracks pagination state and honours a per_page override', async () => {
    getMock.mockResolvedValue(
      paginated([{ id: '1', slug: 'a', title: 'A' }], { page: 2, pages: 4, total: 33 }),
    );
    const posts = usePosts({ perPage: 6 });

    await posts.byType('post', 2);

    expect(getMock).toHaveBeenCalledWith('/cms/posts', {
      params: { type: 'post', page: 2, per_page: 6 },
    });
    expect(posts.page.value).toBe(2);
    expect(posts.pages.value).toBe(4);
    expect(posts.total.value).toBe(33);
  });

  it('byType degrades gracefully on a fetch error (empty list, no throw)', async () => {
    getMock.mockRejectedValue(new Error('network'));
    const posts = usePosts();

    await expect(posts.byType('post', 1)).resolves.toBeDefined();
    expect(posts.items.value).toEqual([]);
    expect(posts.loading.value).toBe(false);
  });

  it('bySlug fetches a single post by path with the type param', async () => {
    getMock.mockResolvedValue({ id: '1', slug: 'about/team', title: 'Team', type: 'page' });
    const posts = usePosts();

    const post = await posts.bySlug('page', 'about/team');

    expect(getMock).toHaveBeenCalledWith('/cms/posts/about/team', {
      params: { type: 'page' },
    });
    expect(post?.title).toBe('Team');
    expect(posts.current.value?.slug).toBe('about/team');
  });

  it('bySearch calls the public search endpoint with q + page (+ default per_page)', async () => {
    getMock.mockResolvedValue(paginated([{ id: '1', slug: 'a', title: 'A' }]));
    const posts = usePosts();

    await posts.bySearch('hospitality', 1);

    expect(getMock).toHaveBeenCalledWith('/cms/search', {
      params: {
        q: 'hospitality',
        page: 1,
        per_page: 20,
      },
    });
    expect(posts.items.value).toHaveLength(1);
    expect(posts.loading.value).toBe(false);
  });

  it('bySearch forwards optional type + term scope filters', async () => {
    getMock.mockResolvedValue(paginated([]));
    const posts = usePosts({ perPage: 5 });

    await posts.bySearch('hospitality', 2, {
      type: 'post',
      termType: 'category',
      termSlug: 'news',
    });

    expect(getMock).toHaveBeenCalledWith('/cms/search', {
      params: {
        q: 'hospitality',
        page: 2,
        per_page: 5,
        type: 'post',
        term_type: 'category',
        term_slug: 'news',
      },
    });
  });

  it('bySearch sends a comma-joined `types` param (not `type`) when types opt is given', async () => {
    getMock.mockResolvedValue(paginated([]));
    const posts = usePosts();

    await posts.bySearch('hospitality', 1, { types: ['page', 'post'] });

    expect(getMock).toHaveBeenCalledWith('/cms/search', {
      params: {
        q: 'hospitality',
        page: 1,
        per_page: 20,
        types: 'page,post',
      },
    });
  });

  it('bySearch prefers `types` over a single `type` when both are supplied', async () => {
    getMock.mockResolvedValue(paginated([]));
    const posts = usePosts();

    await posts.bySearch('hospitality', 1, { type: 'post', types: ['page', 'post'] });

    const [, options] = getMock.mock.calls[0];
    expect(options.params.types).toBe('page,post');
    expect(options.params.type).toBeUndefined();
  });

  it('bySearch ignores an empty `types` array and keeps the single `type` path', async () => {
    getMock.mockResolvedValue(paginated([]));
    const posts = usePosts();

    await posts.bySearch('hospitality', 1, { type: 'post', types: [] });

    expect(getMock).toHaveBeenCalledWith('/cms/search', {
      params: {
        q: 'hospitality',
        page: 1,
        per_page: 20,
        type: 'post',
      },
    });
  });

  it('bySearch tracks pagination state from the response', async () => {
    getMock.mockResolvedValue(
      paginated([{ id: '1', slug: 'a', title: 'A' }], { page: 2, pages: 4, total: 33 }),
    );
    const posts = usePosts();

    await posts.bySearch('x', 2);

    expect(posts.page.value).toBe(2);
    expect(posts.pages.value).toBe(4);
    expect(posts.total.value).toBe(33);
  });

  it('bySearch degrades gracefully on a fetch error (empty list, no throw)', async () => {
    getMock.mockRejectedValue(new Error('network'));
    const posts = usePosts();

    await expect(posts.bySearch('x', 1)).resolves.toBeDefined();
    expect(posts.items.value).toEqual([]);
    expect(posts.loading.value).toBe(false);
  });

  it('byTerm degrades gracefully on a fetch error (empty list, no throw)', async () => {
    getMock.mockRejectedValue(new Error('network'));
    const posts = usePosts();

    await expect(posts.byTerm('post', 'category', 'news', 1)).resolves.toBeDefined();
    expect(posts.items.value).toEqual([]);
    expect(posts.loading.value).toBe(false);
  });

  it('bySlug returns null and does not throw on a 404', async () => {
    getMock.mockRejectedValue({ response: { status: 404 } });
    const posts = usePosts();

    const post = await posts.bySlug('page', 'missing');
    expect(post).toBeNull();
    expect(posts.current.value).toBeNull();
  });
});
