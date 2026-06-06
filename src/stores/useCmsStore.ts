import { defineStore } from 'pinia';
import { api } from '@/api';
import { readSeoHandoff } from '../composables/useSeoHandoff';

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
  /**
   * Display name. The unified `cms_post` engine exposes `title`; legacy
   * `cms_page` rows exposed `name`. The renderer prefers `title` and falls
   * back to `name` so both shapes render identically (slug-parity).
   */
  name?: string;
  title?: string;
  /** `page` | `post` — present on unified cms_post rows. */
  type?: string;
  language: string;
  content_html?: string | null;
  content_json: Record<string, unknown>;
  category_id?: string | null;
  is_published?: boolean;
  /** Unified engine fields (cms_post). */
  layout_id?: string | null;
  style_id?: string | null;
  /**
   * Backend-resolved style: the explicit `style_id` when set, else the
   * admin-designated default style. The renderer must prefer this over the
   * raw `style_id` so pages/posts without an explicit style still pick up
   * the default theme.
   */
  resolved_style_id?: string | null;
  resolved_style_source?: 'explicit' | 'default' | null;
  /**
   * Backend-resolved layout: the explicit `layout_id` when set, else the
   * admin-designated default layout (cms `default_layout_id`). The renderer
   * must prefer this over the raw `layout_id` so layout-less (e.g. imported)
   * pages render with chrome instead of a bare <article>.
   */
  resolved_layout_id?: string | null;
  resolved_layout_source?: 'explicit' | 'default' | 'none' | null;
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
  /**
   * Per-area content for multi-content-area layouts (S55). Keyed by layout
   * area name; the primary content area is served by `content_html` and is
   * NOT present here. The renderer falls back to `content_html` for any area
   * without a block.
   */
  content_blocks?: Record<string, { content_html?: string; source_css?: string | null }>;
  /**
   * Per-page widget assignments (S55) that override the layout's widget for
   * the same area. Access-filtered and widget-enriched server-side; consumed
   * by `CmsLayoutRenderer.widgetFor()` (page-level over layout-level).
   */
  page_assignments?: CmsPageWidgetAssignment[];
}

/**
 * A page-level widget assignment as returned by `GET /cms/posts/<slug>`.
 * Mirrors `CmsLayoutRenderer`'s `WidgetAssignment` prop shape.
 */
export interface CmsPageWidgetAssignment {
  area_name: string;
  widget_id: string;
  sort_order: number;
  required_access_level_ids?: string[];
  widget?: CmsWidgetData;
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

      // Flash-free hand-off (S47.2): when the prerender writer inlined the
      // current slug's content into `#__POST__`, mount it synchronously with no
      // API round-trip. Layout/style are still fetched lazily below if present.
      if (!previewToken) {
        const handoff = readSeoHandoff();
        if (handoff && handoff.slug === slug) {
          this.loading = false;
          this.error = null;
          this.accessDenied = false;
          this.currentLayout = null;
          this.currentStyleCss = null;
          this.currentPage = {
            id: slug,
            slug,
            title: handoff.title,
            name: handoff.title,
            content_html: handoff.content_html,
            content_json: {},
            language: 'en',
            sort_order: 0,
            meta_title: handoff.title,
            meta_description: handoff.seo?.meta_description ?? null,
            og_title: null,
            og_description: null,
            og_image_url: null,
            canonical_url: handoff.seo?.canonical_url ?? null,
            robots: handoff.seo?.robots ?? 'index,follow',
            schema_json: null,
            updated_at: '',
          };
          if (!this.categories.length) this.fetchCategories();
          return;
        }
      }

      this.loading = true;
      this.error = null;
      this.accessDenied = false;
      this.currentPage = null;
      this.currentLayout = null;
      this.currentStyleCss = null;
      try {
        // Fetch post and categories in parallel so both are ready before layout renders
        const [post] = await Promise.all([
          this._fetchPostRaw(slug, previewToken),
          this.categories.length ? Promise.resolve() : this.fetchCategories(),
        ]);
        this.currentPage = post;
        const { layout, css } = await this._fetchPostAssets(post);
        this.currentLayout = layout;
        this.currentStyleCss = css;
        // Warm the cache so a return visit / prefetch hit is instant.
        if (!previewToken) {
          this.pageCache[slug] = { page: post, layout, css };
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
     * Warm the cache for a CMS post (post + layout + style CSS) WITHOUT touching
     * the page currently on screen. Best-effort and deduplicated: an
     * already-cached or in-flight slug is a no-op; failures are cached
     * negatively so a dead/gated/non-CMS slug is not retried.
     */
    async prefetchPage(slug: string) {
      if (!slug || slug in this.pageCache || prefetchInFlight.has(slug)) return;
      prefetchInFlight.add(slug);
      try {
        const post = await this._fetchPostRaw(slug);
        const { layout, css } = await this._fetchPostAssets(post);
        this.pageCache[slug] = { page: post, layout, css };
      } catch {
        this.pageCache[slug] = { page: null, layout: null, css: null };
      } finally {
        prefetchInFlight.delete(slug);
      }
    },

    /**
     * Resolve a slug to a published `cms_post` via the unified engine endpoint
     * `GET /cms/posts/<slug>`. A bare slug must render a `page` OR a `post`, so
     * we try the default (`page`) first and, on a 404, retry once as `post`.
     * Any other error (403 access-gated, etc.) propagates so the caller can
     * surface the right state. The slug stays a raw path segment so nested
     * paths (e.g. `about/team`) resolve.
     */
    async _fetchPostRaw(slug: string, previewToken?: string): Promise<CmsPageItem> {
      const config = previewToken
        ? { params: { preview_token: previewToken } }
        : undefined;
      try {
        return await api.get<CmsPageItem>(`/cms/posts/${slug}`, config);
      } catch (e: any) {
        const status = e?.response?.status ?? e?.status;
        if (status !== 404) throw e;
        // Bare resolution defaults to `page`; retry as `post` for slugs whose
        // content type is a post (e.g. a blog article addressed at the root).
        const postConfig = previewToken
          ? { params: { type: 'post', preview_token: previewToken } }
          : { params: { type: 'post' } };
        return await api.get<CmsPageItem>(`/cms/posts/${slug}`, postConfig);
      }
    },

    /**
     * Fetch a post's layout template + style CSS by id. The backend resolves
     * `resolved_layout_id` / `resolved_style_id` = the explicit id OR the
     * admin-designated default, so we prefer each (falling back to the raw id
     * for payloads from older endpoints). When neither is present the active
     * theme supplies the CSS and the page renders without a layout.
     */
    async _fetchPostAssets(
      post: CmsPageItem,
    ): Promise<{ layout: CmsLayout | null; css: string | null }> {
      const layoutId = post.resolved_layout_id ?? post.layout_id;
      const styleId = post.resolved_style_id ?? post.style_id;
      const [layout, css] = await Promise.all([
        layoutId ? this._fetchLayoutRaw(layoutId) : Promise.resolve(null),
        styleId ? this._fetchStyleCssRaw(styleId) : Promise.resolve(null),
      ]);
      return { layout, css };
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
