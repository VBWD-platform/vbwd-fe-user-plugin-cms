/**
 * S121 — the single source of truth for how a CMS search widget's admin-facing
 * `scope` maps to the backend `/cms/search` post-type filter. Shared by both the
 * `Search` box (quicksearch) and the `SearchResults` widget so the two map
 * identically (DRY — no per-component divergence).
 *
 * Scope model:
 *   pages → type=page   (published pages only)
 *   posts → type=post   (published posts only)
 *   both  → omit type   (all published content, incl. any plugin post-type)
 *
 * Backward-compat: `SearchResults` shipped with a free-text `type` field before
 * S121. When a widget still carries the legacy `type` and no `scope`, we derive
 * the scope at read time (page→pages, post→posts, anything else→both). No data
 * migration is required.
 */
export type SearchScope = 'pages' | 'posts' | 'both';

/**
 * Normalise an admin `scope` (and an optional legacy `type`) into a canonical
 * {@link SearchScope}. An explicit, valid scope always wins; otherwise the
 * legacy `type` is consulted; otherwise we default to `both`.
 */
export function resolveScope(
  scope?: SearchScope | string | null,
  legacyType?: string | null,
): SearchScope {
  if (scope === 'pages' || scope === 'posts' || scope === 'both') {
    return scope;
  }
  if (legacyType === 'page') return 'pages';
  if (legacyType === 'post') return 'posts';
  return 'both';
}

/**
 * Map a widget `scope` (with legacy `type` fallback) to the request `type`
 * accepted by `GET /cms/search`. `both` returns `undefined` (no filter).
 */
export function scopeToType(
  scope?: SearchScope | string | null,
  legacyType?: string | null,
): string | undefined {
  const resolved = resolveScope(scope, legacyType);
  if (resolved === 'pages') return 'page';
  if (resolved === 'posts') return 'post';
  return undefined;
}
