/**
 * Client-side evaluation of CMS middleware-layer routing rules.
 *
 * The backend's `CmsRoutingMiddleware` evaluates these rules for requests
 * directly to Flask. But the SPA serves `/test`, `/about`, etc. from
 * nginx + Vue Router — those never reach the backend, so the rules would
 * not fire without this guard. We mirror the backend matchers client-side
 * for the match types that make sense in a browser
 * (default / path_prefix / cookie / language) and skip ip_range +
 * country (browser cannot evaluate reliably; those stay backend-only).
 *
 * Scope: the guard only fires on the homepage (`home`) and the CMS
 * catch-all (`cms-page`). Host-owned routes (`login`, `dashboard`,
 * profile, etc.) are NEVER hijacked — they're explicit Vue Router
 * records the host owns.
 *
 * Caching: rules fetched once on first navigation and cached for
 * `cacheTtlMs` (default 60s) — admin edits surface within a minute
 * without us hammering the API on every nav.
 *
 * Loop guard: the guard resolves the WHOLE redirect chain in one
 * navigation (rule → target → next rule …), tracking every path it
 * visits. If the chain revisits a path (a cycle like A→B→A) or exceeds
 * `maxRedirectHops`, the guard fails safe — it returns undefined and the
 * originally-requested path renders. Corrupt/looping routing rules can
 * therefore never hang the SPA (regression: the 2026-07 permalink-double
 * rules that forwarded a real slug to a doubled path and back).
 */
import type { INavigationGuard, IRouteLocation } from 'vbwd-view-component';

export interface CmsRoutingRule {
  name: string;
  is_active: boolean;
  priority: number;
  match_type: 'default' | 'language' | 'ip_range' | 'country' | 'path_prefix' | 'path_exact' | 'cookie';
  match_value: string | null;
  target_slug: string;
  redirect_code: 301 | 302;
  is_rewrite: boolean;
  layer: 'middleware' | 'nginx';
}

export interface CmsRoutingGuardApi {
  get: (url: string) => Promise<unknown>;
}

export interface CmsRoutingGuardOptions {
  /** Cache TTL in milliseconds (default: 10_000 = 10 s). */
  cacheTtlMs?: number;
  /** Injected clock for tests. */
  now?: () => number;
  /**
   * Max redirect hops the guard follows for a single navigation before it
   * gives up and fails safe (default: 10). Backstop for a monotonically
   * growing chain that never repeats a path, so the visited-set cycle check
   * cannot catch it (e.g. a path_prefix rule whose target keeps lengthening).
   */
  maxRedirectHops?: number;
}

const SCOPED_ROUTE_NAMES = new Set<string>(['home', 'cms-page']);

export function createCmsMiddlewareRoutingGuard(
  api: CmsRoutingGuardApi,
  options: CmsRoutingGuardOptions = {},
): INavigationGuard {
  const cacheTtlMs = options.cacheTtlMs ?? 10_000;
  const now = options.now ?? (() => Date.now());
  const maxRedirectHops = options.maxRedirectHops ?? 10;

  let cachedRules: CmsRoutingRule[] | null = null;
  let cachedAt = 0;
  // In-flight de-dupe: while a fetch is pending, concurrent navigations share
  // the SAME promise instead of each firing their own GET. Before this, the
  // cache was only populated AFTER the await resolved, so every navigation
  // during the pending window spawned another request — the pile of pending
  // `middleware` XHRs seen on prod.
  let inFlight: Promise<CmsRoutingRule[]> | null = null;

  function invalidate(): void {
    cachedRules = null;
    cachedAt = 0;
    inFlight = null;
  }

  // When the user switches back to this tab (e.g. from the admin tab
  // where they just edited a rule) we drop the cache so the very next
  // navigation sees the fresh rules. Listener installed once at guard
  // construction; SSR-safe via `typeof document` check.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') invalidate();
    });
  }

  async function getRules(): Promise<CmsRoutingRule[]> {
    if (cachedRules !== null && now() - cachedAt < cacheTtlMs) {
      return cachedRules;
    }
    if (inFlight !== null) {
      return inFlight;
    }
    inFlight = (async () => {
      try {
        const fetched = (await api.get('/cms/routing-rules/middleware')) as CmsRoutingRule[];
        cachedRules = Array.isArray(fetched) ? fetched : [];
      } catch {
        // Network / 404 — fail open. Routing rules are an enhancement;
        // they must never block navigation.
        cachedRules = [];
      }
      cachedAt = now();
      inFlight = null;
      return cachedRules;
    })();
    return inFlight;
  }

  return async (to: IRouteLocation) => {
    if (typeof to.name !== 'string' || !SCOPED_ROUTE_NAMES.has(to.name)) {
      return undefined;
    }

    const rules = await getRules();
    const active = rules
      .filter((rule) => rule.is_active)
      .sort((a, b) => a.priority - b.priority);

    // Follow the redirect chain to its settled destination, tracking every
    // path we visit so a cycle (A→B→A) or a runaway chain cannot loop
    // forever. `resolved` is the last path no rule redirects away from.
    const visited = new Set<string>([to.path]);
    let resolved = to.path;
    for (let hop = 0; hop < maxRedirectHops; hop++) {
      const next = nextTarget(active, resolved);
      if (next === null) break; // settled — no rule redirects `resolved`
      if (visited.has(next)) return undefined; // cycle → fail safe
      visited.add(next);
      resolved = next;
    }
    // Either we settled, or we hit the hop cap on a non-repeating chain; if the
    // cap was the exit the destination is still moving, so refuse to redirect.
    if (nextTarget(active, resolved) !== null) return undefined;
    return resolved === to.path ? undefined : resolved;
  };
}

/**
 * The normalised target the first matching rule redirects `path` to, or null
 * when no rule applies (or the sole match is a self-redirect). `path` is the
 * current step in the redirect chain; the cookie/language matchers read their
 * request-scoped context from `document`/`navigator` directly.
 */
function nextTarget(active: CmsRoutingRule[], path: string): string | null {
  for (const rule of active) {
    if (!ruleMatches(rule, path)) continue;
    const target = normaliseTarget(rule.target_slug);
    if (target === path) return null; // self-redirect → treat as settled
    return target;
  }
  return null;
}

function ruleMatches(rule: CmsRoutingRule, path: string): boolean {
  switch (rule.match_type) {
    case 'default':
      // Mirror the backend semantics: a `default` rule applies only at
      // the homepage entry — never on a deep CMS slug, because that
      // would hijack legitimate /:slug navigations.
      return path === '/' || path === '/index.html';

    case 'path_prefix': {
      const value = rule.match_value || '';
      if (!value) return false;
      return path.startsWith(value);
    }

    case 'path_exact': {
      // Exact-path match for canonical redirects (S120): `/home` and `/index`
      // 301 to `/`. Unlike path_prefix this does NOT catch siblings like /home2.
      const value = rule.match_value || '';
      if (!value) return false;
      return path === value;
    }

    case 'cookie': {
      const [rawKey, rawValue] = (rule.match_value || '').split('=');
      const key = (rawKey || '').trim();
      if (!key) return false;
      const expected = (rawValue || '').trim();
      return readCookie(key) === expected;
    }

    case 'language': {
      const target = (rule.match_value || '').toLowerCase();
      if (!target) return false;
      const cookieLang = readCookie('vbwd_lang')?.toLowerCase();
      if (cookieLang === target) return true;
      const browserLang =
        typeof navigator !== 'undefined' && navigator.language
          ? navigator.language.slice(0, 2).toLowerCase()
          : '';
      return browserLang === target;
    }

    case 'ip_range':
    case 'country':
      // Owned by backend middleware — browser cannot evaluate.
      return false;

    default:
      return false;
  }
}

function normaliseTarget(slug: string): string {
  // Two normalisations:
  //   1. Ensure a leading slash so vue-router treats it as an absolute path.
  //   2. Strip trailing slashes (except for root `/`) so a rule whose
  //      author wrote `/home/` does not redirect to the literal slug
  //      `home/` — the CMS catch-all `/:slug(.+)` captures the trailing
  //      slash, the API returns 404 for `home/` even though `home`
  //      exists, and the loop guard fails to short-circuit because
  //      `/home/` !== `/home`.
  const withLeadingSlash = slug.startsWith('/') ? slug : `/${slug}`;
  if (withLeadingSlash === '/') return '/';
  return withLeadingSlash.replace(/\/+$/, '');
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    if (cookie.startsWith(prefix)) return cookie.slice(prefix.length);
  }
  return null;
}
