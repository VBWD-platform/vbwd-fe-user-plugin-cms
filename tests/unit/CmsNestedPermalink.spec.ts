// S122 — fe-user: a nested templated permalink resolves through the existing
// `/:slug(.+)` catch-all to the post view, and the store fetches the full path
// verbatim against the flat `(type, slug)` lookup endpoint.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';

const getMock = vi.fn();

vi.mock('@/api', () => ({
  api: { get: (...args: unknown[]) => getMock(...args) },
  isAuthenticated: () => false,
}));

import { useCmsStore } from '../../src/stores/useCmsStore';

const NESTED = 'blog/2026/electronics/phones/my-post';

describe('fe-user nested permalink resolution (S122)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getMock.mockReset();
  });

  it('captures a deep nested path through the /:slug(.+) catch-all', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/:slug(.+)', name: 'cms-page', component: { template: '<div />' } },
      ],
    });
    await router.push(`/${NESTED}`);
    await router.isReady();
    expect(router.currentRoute.value.name).toBe('cms-page');
    expect(router.currentRoute.value.params.slug).toBe(NESTED);
  });

  it('fetches the full nested path verbatim against /cms/posts/<slug>', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === `/cms/posts/${NESTED}`) {
        return { id: 'p-nested', type: 'post', slug: NESTED, title: 'My Post', content_json: {} };
      }
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });
    const store = useCmsStore();
    await store.fetchPage(NESTED);
    expect(getMock).toHaveBeenCalledWith(`/cms/posts/${NESTED}`, undefined);
    expect(store.currentPage?.slug).toBe(NESTED);
    expect(store.currentPage?.title).toBe('My Post');
  });

  it('retries the nested path as type=post when the page lookup 404s', async () => {
    getMock.mockImplementation(async (url: string, config?: any) => {
      if (url === `/cms/posts/${NESTED}`) {
        if (config?.params?.type === 'post') {
          return { id: 'p-nested', type: 'post', slug: NESTED, title: 'Post Only', content_json: {} };
        }
        const err: any = new Error('not found');
        err.status = 404;
        throw err;
      }
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });
    const store = useCmsStore();
    await store.fetchPage(NESTED);
    expect(getMock).toHaveBeenCalledWith(`/cms/posts/${NESTED}`, { params: { type: 'post' } });
    expect(store.currentPage?.title).toBe('Post Only');
  });
});
