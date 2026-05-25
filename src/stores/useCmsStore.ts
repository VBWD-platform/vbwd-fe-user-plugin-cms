import { defineStore } from 'pinia';
import { api } from '@/api';

export interface CmsCategory {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

export interface CmsPageItem {
  id: string;
  slug: string;
  name: string;
  language: string;
  content_json: Record<string, unknown>;
  category_id: string | null;
  is_published: boolean;
  sort_order: number;
  meta_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  canonical_url: string | null;
  robots: string;
  schema_json: Record<string, unknown> | null;
  updated_at: string;
}

export interface PaginatedPages {
  items: CmsPageItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface CmsAreaDefinition {
  name: string;
  type: string;
  label: string;
}

export interface CmsWidgetAssignment {
  id?: string;
  widget_id: string;
  area_name: string;
  sort_order: number;
  widget?: CmsWidgetData;
}

export interface CmsWidgetData {
  id: string;
  slug: string;
  name: string;
  widget_type: 'html' | 'menu' | 'slideshow' | 'vue-component';
  content_json: Record<string, unknown> | null;
  source_css: string | null;
  config: Record<string, unknown> | null;
  menu_items?: CmsMenuItemData[];
}

export interface CmsMenuItemData {
  id: string;
  parent_id: string | null;
  label: string;
  url: string | null;
  page_slug: string | null;
  target: string;
  icon: string | null;
  sort_order: number;
}

export interface CmsLayout {
  id: string;
  slug: string;
  name: string;
  areas: CmsAreaDefinition[];
  assignments: CmsWidgetAssignment[];
}

interface CachedCmsPage {
  page: CmsPageItem | null;
  layout: CmsLayout | null;
  css: string | null;
}

// Module-level dedupe of in-flight prefetches (non-reactive on purpose).
const prefetchInFlight = new Set<string>();

interface CmsStoreState {
  categories: CmsCategory[];
  pageList: PaginatedPages | null;
  currentPage: CmsPageItem | null;
  currentLayout: CmsLayout | null;
  currentStyleCss: string | null;
  loading: boolean;
  error: string | null;
  accessDenied: boolean;
  // Prefetch caches — single source of truth shared by fetchPage + prefetchPage.
  pageCache: Record<string, CachedCmsPage>;
  layoutCache: Record<string, CmsLayout>;
  styleCssCache: Record<string, string>;
}

export const useCmsStore = defineStore('cms-user', {
  state: (): CmsStoreState => ({
    categories: [],
    pageList: null,
    currentPage: null,
    currentLayout: null,
    currentStyleCss: null,
    loading: false,
    error: null,
    accessDenied: false,
    pageCache: {},
    layoutCache: {},
    styleCssCache: {},
  }),

  actions: {
    async fetchCategories() {
      try {
        const res = await api.get<any>('/cms/categories');
        this.categories = res.items ?? res ?? [];
      } catch (e) {
        console.warn('[CMS] fetchCategories failed', e);
      }
    },

    async fetchPages(params: { category?: string; page?: number; per_page?: number } = {}) {
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get<any>('/cms/pages', { params });
        this.pageList = res;
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load pages';
      } finally {
        this.loading = false;
      }
    },

    async fetchPage(slug: string, previewToken?: string) {
      // Cache-first (never for preview drafts): instant, no spinner, no network.
      const cached = previewToken ? undefined : this.pageCache[slug];
      if (cached && cached.page) {
        this.loading = false;
        this.error = null;
        this.accessDenied = false;
        this.currentPage = cached.page;
        this.currentLayout = cached.layout;
        this.currentStyleCss = cached.css;
        if (!this.categories.length) this.fetchCategories();
        return;
      }

      this.loading = true;
      this.error = null;
      this.accessDenied = false;
      this.currentPage = null;
      this.currentLayout = null;
      this.currentStyleCss = null;
      try {
        // Fetch page and categories in parallel so both are ready before layout renders
        const params = previewToken ? `?preview_token=${previewToken}` : '';
        const [res] = await Promise.all([
          api.get<any>(`/cms/pages/${slug}${params}`),
          this.categories.length ? Promise.resolve() : this.fetchCategories(),
        ]);
        this.currentPage = res;
        // Eagerly fetch layout and style when present.
        // Prefer `resolved_style_id` (sprint 26) so pages without an
        // explicit `style_id` pick up the admin-designated default style.
        // Falls back to legacy `style_id` for older backend responses.
        const layoutId = (res as any).layout_id;
        const styleId =
          (res as any).resolved_style_id ?? (res as any).style_id;
        const [layout, css] = await Promise.all([
          layoutId ? this._fetchLayoutRaw(layoutId) : Promise.resolve(null),
          styleId ? this._fetchStyleCssRaw(styleId) : Promise.resolve(null),
        ]);
        this.currentLayout = layout;
        this.currentStyleCss = css;
        // Warm the cache so a return visit / prefetch hit is instant.
        if (!previewToken) {
          this.pageCache[slug] = { page: res, layout, css };
        }
      } catch (e: any) {
        const status = e?.response?.status ?? e?.status;
        if (status === 403) {
          this.accessDenied = true;
          this.error = 'Access denied';
        } else {
          this.error = e?.message ?? 'Page not found';
        }
      } finally {
        this.loading = false;
      }
    },

    /**
     * Warm the cache for a CMS page (page + layout + style CSS) WITHOUT touching
     * the page currently on screen. Best-effort and deduplicated: an
     * already-cached or in-flight slug is a no-op; failures are cached
     * negatively so a dead/gated/non-CMS slug is not retried.
     */
    async prefetchPage(slug: string) {
      if (!slug || slug in this.pageCache || prefetchInFlight.has(slug)) return;
      prefetchInFlight.add(slug);
      try {
        const page = await api.get<any>(`/cms/pages/${slug}`);
        const layoutId = (page as any).layout_id;
        const styleId = (page as any).resolved_style_id ?? (page as any).style_id;
        const [layout, css] = await Promise.all([
          layoutId ? this._fetchLayoutRaw(layoutId) : Promise.resolve(null),
          styleId ? this._fetchStyleCssRaw(styleId) : Promise.resolve(null),
        ]);
        this.pageCache[slug] = { page, layout, css };
      } catch {
        this.pageCache[slug] = { page: null, layout: null, css: null };
      } finally {
        prefetchInFlight.delete(slug);
      }
    },

    async fetchLayout(id: string) {
      this.currentLayout = await this._fetchLayoutRaw(id);
    },

    async _fetchLayoutRaw(id: string): Promise<CmsLayout | null> {
      if (this.layoutCache[id]) return this.layoutCache[id];
      try {
        const res = await api.get<any>(`/cms/layouts/${id}`);
        this.layoutCache[id] = res;
        return res;
      } catch (e) {
        console.warn('[CMS] fetchLayout failed', e);
        return null;
      }
    },

    async fetchStyleCss(id: string) {
      this.currentStyleCss = await this._fetchStyleCssRaw(id);
    },

    async _fetchStyleCssRaw(id: string): Promise<string | null> {
      if (this.styleCssCache[id] != null) return this.styleCssCache[id];
      try {
        const resp = await fetch(`/api/v1/cms/styles/${id}/css`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const css = await resp.text();
        this.styleCssCache[id] = css;
        return css;
      } catch (e) {
        console.warn('[CMS] fetchStyleCss failed', e);
        return null;
      }
    },
  },
});
