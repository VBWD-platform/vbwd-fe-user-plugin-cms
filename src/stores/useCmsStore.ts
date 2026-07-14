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
  /** Short post summary. Posts render it under the title; pages ignore it. */
  excerpt?: string | null;
  /** Featured image URL — posts back the magazine hero header with it. */
  featured_image_url?: string | null;
  /**
   * Per-type JSON bag (cms_post `type_data`). Posts read
   * `show_featured_hero` off it: absent = hero ON (default), `false` = off.
   */
  type_data?: Record<string, unknown> | null;
  /** `page` | `post` — present on unified cms_post rows. */
  type?: string;
  language: string;
  content_html?: string | null;
  /** The editor CSS-tab override, layered on top of the resolved style. */
  source_css?: string | null;
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
  /**
   * Taxonomy terms (categories + tags) attached to a post, as returned by
   * `GET /cms/posts/<slug>`. `term_type` is `"category"` or `"tag"`. Used by
   * the post page type to render a tag cloud under the title.
   */
  terms?: Array<{
    id: string;
    term_type: string;
    slug: string;
    name: string;
    parent_id?: string | null;
    /**
     * Runtime-only navigable archive URL for the term (e.g. `"category/uncategorized"`),
     * returned by the backend `_with_terms` serializer. The breadcrumb links the
     * category crumb to `'/' + archive_url` (resolved by the `/:slug(.+)` catch-all).
     */
    archive_url?: string;
  }>;
  /**
   * The post's primary category term id (returned at runtime alongside `terms`).
   * The breadcrumb prefers the term whose `id` matches this when a post carries
   * multiple category terms.
   */
  primary_term_id?: string | null;
  /**
   * S77 — generic core tags / custom fields appended by the backend serializer
   * (`append_tags_and_custom_fields`), ALONGSIDE the legacy `terms` taxonomy.
   * Rendered by the shared fe-core read-only display components.
   */
  tags?: string[];
  custom_fields?: Record<string, unknown>;
  custom_field_defs?: import('vbwd-view-component').CustomFieldDef[];
  /**
   * Present ONLY on a synthetic term-archive page (a category/tag archive that
   * has no backing `cms_post`). Carries the resolved term so the shared
   * `terms-archive` layout's `TermArchive` widget can render the term name +
   * description without a second fetch. Absent on every real page/post.
   */
  term_archive?: CmsTermArchiveContext;
  /**
   * Present ONLY on a synthetic PREFIX-archive page (the WordPress-style
   * `/blog/2026` / `/blog/2026/news` listing that has no backing `cms_post`).
   * Set by `_resolvePrefixArchive` from `GET /cms/archive/<prefix>`; the
   * breadcrumb provider keys off `type === 'archive'` + this prefix, and the
   * shared archive widget lists {@link items}. Absent on every real page/post.
   */
  archive_prefix?: string;
  /** The posts listed by a prefix archive (see {@link archive_prefix}). */
  items?: CmsArchiveItem[];
  /** Pagination echoed by the prefix-archive endpoint (first page for now). */
  archive_total?: number;
  archive_page?: number;
  archive_per_page?: number;
  archive_pages?: number;
}

/** The resolved term backing a dynamic term archive (see {@link CmsPageItem}). */
export interface CmsTermArchiveContext {
  term_type: string;
  slug: string;
  name: string;
  description?: string | null;
}

/** A single post summary as listed by a prefix archive. */
export interface CmsArchiveItem {
  id: string;
  type: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  published_at?: string | null;
  og_image_url?: string | null;
  [key: string]: unknown;
}

/** The `GET /cms/archive/<prefix>` response envelope. */
export interface CmsArchiveResponse {
  prefix: string;
  title: string;
  items: CmsArchiveItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
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
  /**
   * Per-page override for THIS page's widget instance. A structured object with
   * only the keys relevant to the widget type; each is applied OVER the widget
   * record's own value at render time, for this page only (layout-level
   * assignments are unaffected). Absent/null → use the widget's values unchanged.
   *   config:       vue-component field overrides (merged over widget.config)
   *   content_html: html content override (plain HTML, re-encoded for the renderer)
   *   source_css:   per-page CSS override (any widget type)
   *   menu_items:   menu override (replaces widget.menu_items)
   */
  config_override?: CmsPageWidgetOverride | null;
}

/** Structured per-page widget override (see {@link CmsPageWidgetAssignment}). */
export interface CmsPageWidgetOverride {
  config?: Record<string, unknown>;
  content_html?: string;
  source_css?: string;
  menu_items?: CmsMenuItemData[];
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
  head_html?: string | null;
}

interface CachedCmsPage {
  page: CmsPageItem | null;
  layout: CmsLayout | null;
  css: string | null;
}

// Module-level dedupe of in-flight prefetches (non-reactive on purpose).
const prefetchInFlight = new Set<string>();

// The ONE shared layout that renders every category AND tag archive (seeded by
// the backend under this fixed slug). Single source of truth for the fe fetch.
const TERMS_ARCHIVE_LAYOUT_SLUG = 'terms-archive';

// A term-archive slug: a fixed `category/` or `tag/` prefix + the term slug
// (which may itself be nested). Group 1 = term type, group 2 = term slug.
const TERM_ARCHIVE_SLUG_PATTERN = /^(category|tag)\/(.+)$/;

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
        // Unified engine: pages live in `cms_post` as `type=page`, filtered by
        // `cms_term` categories via `term_type=category` + `term_slug`. Mirrors
        // `usePosts.byTerm()`. Replaces the removed legacy `GET /cms/pages`.
        const res = await api.get<PaginatedPages>('/cms/posts', {
          params: {
            type: 'page',
            term_type: 'category',
            term_slug: params.category,
            page: params.page,
            per_page: params.per_page,
          },
        });
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
        // Resolve the page/post (and its assets) in parallel with categories so
        // both are ready before the layout renders. Term archives are resolved
        // inside `_resolvePageOrTerm` ONLY after page+post both 404.
        const [resolved] = await Promise.all([
          this._resolvePageOrTerm(slug, previewToken),
          this.categories.length ? Promise.resolve() : this.fetchCategories(),
        ]);
        this.currentPage = resolved.page;
        this.currentLayout = resolved.layout;
        this.currentStyleCss = resolved.css;
        // Warm the cache so a return visit / prefetch hit is instant.
        if (!previewToken) {
          this.pageCache[slug] = resolved;
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
      // A term-archive slug (`category/…` / `tag/…`) is NOT a post: warming it
      // via the post endpoint only ever fired two dead 404s per tag pill
      // (/cms/posts/tag/x and its ?type=post retry). Prefetch is best-effort, so
      // skip these entirely — a real click still resolves them through the
      // page → post → term precedence in `fetchPage`. We deliberately do NOT
      // negative-cache, so the slug stays resolvable on navigation.
      if (TERM_ARCHIVE_SLUG_PATTERN.test(slug)) return;
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

    /**
     * Resolve a slug to a renderable page in strict precedence order:
     * **page → post → term archive**. A page or post is resolved (with its
     * layout + style) exactly as before. ONLY when both 404 — and never for a
     * preview draft — a `category/<slug>` / `tag/<slug>` slug falls through to
     * term resolution, so an existing page (e.g. `category/backend`) always wins.
     * Any non-404 error (403 access-gated, etc.) propagates unchanged.
     */
    async _resolvePageOrTerm(
      slug: string,
      previewToken?: string,
    ): Promise<CachedCmsPage> {
      try {
        const post = await this._fetchPostRaw(slug, previewToken);
        const { layout, css } = await this._fetchPostAssets(post);
        return { page: post, layout, css };
      } catch (e: any) {
        const status = e?.response?.status ?? e?.status;
        if (status !== 404 || previewToken) throw e;
        const termArchive = await this._resolveTermArchive(slug);
        if (termArchive) return termArchive;
        // FINAL fallback: a WordPress-style prefix archive (`/blog/2026`,
        // `/blog/2026/news`, `/blog`) that lists every published post whose slug
        // starts with `<slug>/`. Only reached after page + post + term all 404.
        const prefixArchive = await this._resolvePrefixArchive(slug);
        if (prefixArchive) return prefixArchive;
        throw e;
      }
    },

    /**
     * Resolve a slug to a synthetic PREFIX-archive page via
     * `GET /cms/archive/<path>`. Returns `null` when no published post lives
     * under the prefix (endpoint 404) so the caller falls through to the normal
     * not-found handling. On 200 the synthetic page is bound to the shared
     * `terms-archive` layout (the same one that renders term archives) and marked
     * `type: 'archive'` so the breadcrumb provider and archive widget recognise
     * it. Non-404 failures are treated as "not an archive" (null) too.
     */
    async _resolvePrefixArchive(path: string): Promise<CachedCmsPage | null> {
      let archive: CmsArchiveResponse;
      try {
        archive = await api.get<CmsArchiveResponse>(`/cms/archive/${path}`);
      } catch {
        return null;
      }

      const [layout, css] = await Promise.all([
        this._fetchLayoutBySlugRaw(TERMS_ARCHIVE_LAYOUT_SLUG),
        this._fetchDefaultStyleCss(),
      ]);
      return { page: this._buildPrefixArchivePage(path, archive, layout), layout, css };
    },

    /** Build the synthetic CmsPageItem for a resolved prefix archive. */
    _buildPrefixArchivePage(
      path: string,
      archive: CmsArchiveResponse,
      layout: CmsLayout | null,
    ): CmsPageItem {
      return {
        id: `prefix-archive:${path}`,
        slug: path,
        type: 'archive',
        title: archive.title,
        name: archive.title,
        content_html: '',
        content_json: {},
        language: 'en',
        resolved_layout_id: layout?.id ?? null,
        sort_order: 0,
        meta_title: archive.title,
        meta_description: null,
        og_title: null,
        og_description: null,
        og_image_url: null,
        canonical_url: null,
        robots: 'index,follow',
        schema_json: null,
        updated_at: '',
        archive_prefix: path,
        items: archive.items ?? [],
        archive_total: archive.total,
        archive_page: archive.page,
        archive_per_page: archive.per_page,
        archive_pages: archive.pages,
      };
    },

    /**
     * Resolve a `category/<slug>` / `tag/<slug>` slug to a synthetic term-archive
     * page rendered by the shared `terms-archive` layout. Returns `null` when the
     * slug is not a term-archive path or the term does not exist, so the caller
     * falls through to the normal not-found handling. The `TermArchive` widget on
     * the shared layout reads the term from the route + this synthetic page's
     * `term_archive` context and lists the term's posts.
     */
    async _resolveTermArchive(slug: string): Promise<CachedCmsPage | null> {
      const match = TERM_ARCHIVE_SLUG_PATTERN.exec(slug);
      if (!match) return null;
      const [, termType, termSlug] = match;

      let term: CmsTermArchiveContext;
      try {
        term = await api.get<CmsTermArchiveContext>(
          `/cms/terms/${termType}/${termSlug}`,
        );
      } catch {
        return null;
      }

      const [layout, css] = await Promise.all([
        this._fetchLayoutBySlugRaw(TERMS_ARCHIVE_LAYOUT_SLUG),
        this._fetchDefaultStyleCss(),
      ]);
      return { page: this._buildTermArchivePage(slug, term, layout), layout, css };
    },

    /** Build the synthetic CmsPageItem for a resolved term archive. */
    _buildTermArchivePage(
      slug: string,
      term: CmsTermArchiveContext,
      layout: CmsLayout | null,
    ): CmsPageItem {
      return {
        id: `term-archive:${term.term_type}:${term.slug}`,
        slug,
        type: 'page',
        title: term.name,
        name: term.name,
        content_html: '',
        content_json: {},
        language: 'en',
        resolved_layout_id: layout?.id ?? null,
        sort_order: 0,
        meta_title: term.name,
        meta_description: term.description ?? null,
        og_title: null,
        og_description: null,
        og_image_url: null,
        canonical_url: null,
        robots: 'index,follow',
        schema_json: null,
        updated_at: '',
        term_archive: {
          term_type: term.term_type,
          slug: term.slug,
          name: term.name,
          description: term.description ?? null,
        },
      };
    },

    /** Fetch the shared layout by slug (widgets embedded). Null on failure. */
    async _fetchLayoutBySlugRaw(slug: string): Promise<CmsLayout | null> {
      try {
        const layout = await api.get<CmsLayout>(`/cms/layouts/by-slug/${slug}`);
        if (layout?.id) this.layoutCache[layout.id] = layout;
        return layout;
      } catch (e) {
        console.warn('[CMS] fetchLayoutBySlug failed', e);
        return null;
      }
    },

    /** Fetch the active default style CSS (term archives have no explicit style). */
    async _fetchDefaultStyleCss(): Promise<string | null> {
      try {
        const resp = await fetch('/api/v1/cms/styles/default/css');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.text();
      } catch (e) {
        console.warn('[CMS] fetchDefaultStyleCss failed', e);
        return null;
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
