import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const getMock = vi.fn();

vi.mock('@/api', () => ({
  api: { get: (...args: unknown[]) => getMock(...args) },
  isAuthenticated: () => false,
}));

import { useCmsStore } from '../../src/stores/useCmsStore';

describe('useCmsStore — S55.3 multi-area data passthrough', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getMock.mockReset();
  });

  it('carries content_blocks + page_assignments from /cms/posts/<slug> onto currentPage', async () => {
    const contentBlocks = {
      'content-above': { content_html: '<p>above</p>', source_css: '.above{}' },
      sidebar: { content_html: '<aside>side</aside>', source_css: null as unknown as string },
    };
    const pageAssignments = [
      {
        area_name: 'sidebar-widget',
        widget_id: 'W-PAGE',
        sort_order: 0,
        required_access_level_ids: [],
        widget: {
          id: 'W-PAGE',
          slug: 'page-w',
          name: 'Page Widget',
          widget_type: 'html',
          content_json: { content: 'PHA+cGFnZTwvcD4=' },
          source_css: null,
          config: null,
        },
      },
    ];

    getMock.mockImplementation(async (url: string) => {
      if (url === '/cms/posts/areas') {
        return {
          id: 'p-areas',
          type: 'page',
          slug: 'areas',
          title: 'Areas',
          content_html: '<p>main</p>',
          content_json: null,
          layout_id: null,
          style_id: null,
          content_blocks: contentBlocks,
          page_assignments: pageAssignments,
        };
      }
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    const store = useCmsStore();
    await store.fetchPage('areas');

    expect(store.currentPage?.content_blocks).toEqual(contentBlocks);
    expect(store.currentPage?.page_assignments).toEqual(pageAssignments);
  });

  it('fetchPages hits the unified /cms/posts list (type=page, term_type=category) — not legacy /cms/pages', async () => {
    const listResult = {
      items: [
        { id: 'p1', slug: 'about', title: 'About', type: 'page' },
        { id: 'p2', slug: 'team', title: 'Team', type: 'page' },
      ],
      total: 2,
      page: 1,
      per_page: 20,
      pages: 1,
    };

    getMock.mockImplementation(async (url: string) => {
      if (url === '/cms/posts') return listResult;
      return {};
    });

    const store = useCmsStore();
    await store.fetchPages({ category: 'company', page: 1, per_page: 20 });

    const calledUrls = getMock.mock.calls.map((call) => call[0]);
    expect(calledUrls).toContain('/cms/posts');
    expect(calledUrls).not.toContain('/cms/pages');

    const [, config] = getMock.mock.calls[0];
    expect(config).toEqual({
      params: {
        type: 'page',
        term_type: 'category',
        term_slug: 'company',
        page: 1,
        per_page: 20,
      },
    });

    expect(store.pageList).toEqual(listResult);
    expect(store.loading).toBe(false);
  });

  it('fetchPages omits term_slug when no category is given', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === '/cms/posts') return { items: [], total: 0, page: 1, per_page: 20, pages: 0 };
      return {};
    });

    const store = useCmsStore();
    await store.fetchPages();

    const [url, config] = getMock.mock.calls[0];
    expect(url).toBe('/cms/posts');
    expect(config.params.type).toBe('page');
    expect(config.params.term_type).toBe('category');
    expect(config.params.term_slug).toBeUndefined();
  });

  it('leaves content_blocks/page_assignments undefined when the endpoint omits them', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === '/cms/posts/plain') {
        return {
          id: 'p-plain',
          type: 'page',
          slug: 'plain',
          title: 'Plain',
          content_html: '<p>main</p>',
          content_json: null,
          layout_id: null,
          style_id: null,
        };
      }
      if (url.startsWith('/cms/categories')) return { items: [] };
      return {};
    });

    const store = useCmsStore();
    await store.fetchPage('plain');

    expect(store.currentPage?.content_blocks).toBeUndefined();
    expect(store.currentPage?.page_assignments).toBeUndefined();
  });
});
