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

interface CmsStoreState {
  categories: CmsCategory[];
  pageList: PaginatedPages | null;
  currentPage: CmsPageItem | null;
  currentLayout: CmsLayout | null;
  currentStyleCss: string | null;
  loading: boolean;
  error: string | null;
  accessDenied: boolean;
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
        // Eagerly fetch layout and style when present
        const layoutId = (res as any).layout_id;
        const styleId = (res as any).style_id;
        await Promise.all([
          layoutId ? this.fetchLayout(layoutId) : Promise.resolve(),
          styleId ? this.fetchStyleCss(styleId) : Promise.resolve(),
        ]);
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

    async fetchLayout(id: string) {
      try {
        const res = await api.get<any>(`/cms/layouts/${id}`);
        this.currentLayout = res;
      } catch (e) {
        console.warn('[CMS] fetchLayout failed', e);
      }
    },

    async fetchStyleCss(id: string) {
      try {
        const resp = await fetch(`/api/v1/cms/styles/${id}/css`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        this.currentStyleCss = await resp.text();
      } catch (e) {
        console.warn('[CMS] fetchStyleCss failed', e);
      }
    },
  },
});
