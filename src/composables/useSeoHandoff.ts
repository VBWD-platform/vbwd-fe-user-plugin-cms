/**
 * S47.2 — the static→SPA hand-off mechanism (flash-free takeover).
 *
 * The prerender writer (47.1) inlines two things into `${VAR_DIR}/seo/<slug>.html`:
 *   1. a `<script type="application/json" id="__POST__">` payload (slug, title,
 *      content_html, seo) so the SPA can mount the same markup synchronously
 *      without a redundant `GET /cms/posts/<slug>`;
 *   2. server-emitted `<meta>`/`<link>` head tags carrying `data-seo="ssr"`.
 *
 * This module exposes the reusable seam consumed by 47.3's PostDetail:
 *   - `readSeoHandoff()` returns the inlined post state (or null → caller fetches);
 *   - `injectSeoMeta()` updates the head tags IN PLACE keyed by `data-seo="ssr"`
 *     (the fix for today's blind `appendChild` in CmsPage.vue), so title /
 *     description / canonical / og are never duplicated across navigations.
 */

export const SEO_HANDOFF_ELEMENT_ID = '__POST__';

/** Attribute (not value) used as the dedup key on server- and client-set tags. */
export const SEO_SSR_MARKER = 'data-seo';
export const SEO_SSR_MARKER_VALUE = 'ssr';

export interface SeoHandoffSeo {
  robots?: string | null;
  canonical_url?: string | null;
  meta_description?: string | null;
}

export interface SeoHandoffState {
  slug: string;
  title: string;
  content_html: string;
  seo?: SeoHandoffSeo;
}

/**
 * Read the inlined `#__POST__` payload written by the prerender writer.
 * Returns null when absent (logged-in / cold SPA route) or unparseable, so the
 * caller falls back to an API fetch. Idempotent and side-effect free.
 */
export function readSeoHandoff(): SeoHandoffState | null {
  if (typeof document === 'undefined') return null;
  const element = document.getElementById(SEO_HANDOFF_ELEMENT_ID);
  if (!element || !element.textContent) return null;
  try {
    const parsed = JSON.parse(element.textContent) as Partial<SeoHandoffState>;
    if (typeof parsed.slug !== 'string') return null;
    return {
      slug: parsed.slug,
      title: parsed.title ?? '',
      content_html: parsed.content_html ?? '',
      seo: parsed.seo,
    };
  } catch {
    return null;
  }
}

/** The SEO-bearing fields a content page exposes (subset of CmsPageItem). */
export interface SeoMetaSource {
  name?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  robots?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  canonical_url?: string | null;
  schema_json?: Record<string, unknown> | null;
}

type MetaSpec =
  | { kind: 'meta'; name: string; content: string | null | undefined }
  | { kind: 'property'; property: string; content: string | null | undefined }
  | { kind: 'link'; rel: string; href: string | null | undefined }
  | { kind: 'jsonld'; json: Record<string, unknown> | null | undefined };

function metaSelector(spec: MetaSpec): string {
  switch (spec.kind) {
    case 'meta':
      return `meta[name="${spec.name}"]`;
    case 'property':
      return `meta[property="${spec.property}"]`;
    case 'link':
      return `link[rel="${spec.rel}"]`;
    case 'jsonld':
      return 'script[type="application/ld+json"]';
  }
}

function upsert(spec: MetaSpec): void {
  const existing = document.head.querySelector(
    `${metaSelector(spec)}[${SEO_SSR_MARKER}="${SEO_SSR_MARKER_VALUE}"]`,
  );

  const value =
    spec.kind === 'link'
      ? spec.href
      : spec.kind === 'jsonld'
        ? spec.json
        : spec.content;

  // Empty value → remove any prior tag so stale meta does not linger.
  if (value === null || value === undefined || value === '') {
    if (existing) existing.remove();
    return;
  }

  const element =
    existing ?? document.createElement(spec.kind === 'link' ? 'link' : spec.kind === 'jsonld' ? 'script' : 'meta');
  element.setAttribute(SEO_SSR_MARKER, SEO_SSR_MARKER_VALUE);

  switch (spec.kind) {
    case 'meta':
      element.setAttribute('name', spec.name);
      element.setAttribute('content', String(value));
      break;
    case 'property':
      element.setAttribute('property', spec.property);
      element.setAttribute('content', String(value));
      break;
    case 'link':
      element.setAttribute('rel', spec.rel);
      element.setAttribute('href', String(value));
      break;
    case 'jsonld':
      element.setAttribute('type', 'application/ld+json');
      element.textContent = JSON.stringify(value);
      break;
  }

  if (!existing) document.head.appendChild(element);
}

/**
 * Inject (or update-in-place) the page's head tags. Every tag is keyed by
 * `data-seo="ssr"` so a second call — or a navigation to another page —
 * REPLACES the prior tag instead of appending a duplicate. The title is owned
 * directly via `document.title`.
 */
export function injectSeoMeta(page: SeoMetaSource): void {
  if (typeof document === 'undefined') return;

  const title = page.meta_title || page.name || '';
  if (title) document.title = title;

  const ogTitle = page.og_title || title;

  upsert({ kind: 'meta', name: 'description', content: page.meta_description });
  upsert({ kind: 'meta', name: 'robots', content: page.robots });
  upsert({ kind: 'link', rel: 'canonical', href: page.canonical_url });
  upsert({ kind: 'property', property: 'og:title', content: ogTitle });
  upsert({ kind: 'property', property: 'og:description', content: page.og_description });
  upsert({ kind: 'property', property: 'og:image', content: page.og_image_url });
  upsert({ kind: 'jsonld', json: page.schema_json });
}

// ── RSS feed autodiscovery (S47.5) ──────────────────────────────────────────

/** MIME type browsers/readers use to autodiscover an RSS 2.0 feed. */
export const RSS_FEED_TYPE = 'application/rss+xml';

const RSS_FEED_ROUTE = '/api/v1/cms/rss.xml';

/** A descriptor for one RSS feed the current page advertises. */
export interface RssFeedDescriptor {
  title: string;
  href: string;
}

/** Inputs for `rssFeedHref` — the same filters the backend route accepts. */
export interface RssFeedTarget {
  type?: string;
  termType?: string;
  termSlug?: string;
}

/**
 * Build the backend RSS feed URL for a blog or per-term archive. Mirrors the
 * S47.5 route contract (`?type=&term_type=&term_slug=`); every value is
 * URL-encoded so special characters in slugs cannot break the query string.
 */
export function rssFeedHref(target: RssFeedTarget): string {
  const params = new URLSearchParams();
  params.set('type', target.type || 'post');
  if (target.termType && target.termSlug) {
    params.set('term_type', target.termType);
    params.set('term_slug', target.termSlug);
  }
  return `${RSS_FEED_ROUTE}?${params.toString()}`;
}

/**
 * Advertise the page's RSS feeds via `<link rel="alternate" ...>` tags, reusing
 * the same `data-seo="ssr"` dedup marker as `injectSeoMeta`. The full RSS set is
 * replaced on every call: stale feeds from the previous page are removed and the
 * requested feeds re-emitted, so navigating between blog/term pages never leaves
 * a duplicate or wrong-term link behind.
 */
export function injectRssAutodiscovery(feeds: RssFeedDescriptor[]): void {
  if (typeof document === 'undefined') return;

  const selector = `link[rel="alternate"][type="${RSS_FEED_TYPE}"][${SEO_SSR_MARKER}="${SEO_SSR_MARKER_VALUE}"]`;
  document.head.querySelectorAll(selector).forEach((element) => element.remove());

  for (const feed of feeds) {
    if (!feed.href) continue;
    const link = document.createElement('link');
    link.setAttribute('rel', 'alternate');
    link.setAttribute('type', RSS_FEED_TYPE);
    link.setAttribute('title', feed.title);
    link.setAttribute('href', feed.href);
    link.setAttribute(SEO_SSR_MARKER, SEO_SSR_MARKER_VALUE);
    document.head.appendChild(link);
  }
}
