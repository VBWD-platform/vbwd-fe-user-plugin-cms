import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCmsMiddlewareRoutingGuard } from '../../src/routing/middlewareRoutingGuard';
import type { IRouteLocation } from 'vbwd-view-component';

function loc(path: string, name = 'cms-page'): IRouteLocation {
  return {
    path,
    fullPath: path,
    name,
    params: {},
    query: {},
    meta: {},
  };
}

const FROM = loc('/');

function makeApi(rules: unknown[]) {
  return {
    get: vi.fn(async (url: string) => {
      if (url === '/cms/routing-rules/middleware') return rules;
      throw new Error(`unexpected url: ${url}`);
    }),
  };
}

describe('cmsMiddlewareRoutingGuard', () => {
  beforeEach(() => {
    // Reset document.cookie for cookie-matcher specs
    Object.defineProperty(document, 'cookie', { writable: true, value: '' });
  });

  describe('scope', () => {
    it('does NOT fire on host-owned routes (login)', async () => {
      const api = makeApi([
        { name: 'd', is_active: true, priority: 0, match_type: 'default',
          match_value: null, target_slug: '/home', redirect_code: 302,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      const result = await guard(loc('/login', 'login'), FROM);

      expect(result).toBeUndefined();
      expect(api.get).not.toHaveBeenCalled();
    });

    it('does NOT fire on /dashboard', async () => {
      const api = makeApi([
        { name: 'p', is_active: true, priority: 0, match_type: 'path_prefix',
          match_value: '/dash', target_slug: '/somewhere', redirect_code: 302,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      const result = await guard(loc('/dashboard', 'dashboard'), FROM);

      expect(result).toBeUndefined();
    });

    it('fires on the home route', async () => {
      const api = makeApi([
        { name: 'd', is_active: true, priority: 0, match_type: 'default',
          match_value: null, target_slug: '/home', redirect_code: 302,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      const result = await guard(loc('/', 'home'), FROM);

      expect(result).toBe('/home');
    });

    it('fires on the CMS catch-all route', async () => {
      const api = makeApi([
        { name: 'p', is_active: true, priority: 0, match_type: 'path_prefix',
          match_value: '/test', target_slug: '/home', redirect_code: 302,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      const result = await guard(loc('/test', 'cms-page'), FROM);

      expect(result).toBe('/home');
    });
  });

  describe('matchers', () => {
    it('default matcher only matches root / and /index.html', async () => {
      const api = makeApi([
        { name: 'd', is_active: true, priority: 0, match_type: 'default',
          match_value: null, target_slug: '/home', redirect_code: 302,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      expect(await guard(loc('/', 'home'), FROM)).toBe('/home');
      expect(await guard(loc('/index.html', 'home'), FROM)).toBe('/home');
      // CMS catch-all path: default should NOT redirect (would loop)
      expect(await guard(loc('/about', 'cms-page'), FROM)).toBeUndefined();
    });

    it('path_prefix matches when to.path starts with match_value', async () => {
      const api = makeApi([
        { name: 'p', is_active: true, priority: 0, match_type: 'path_prefix',
          match_value: '/test', target_slug: '/home', redirect_code: 302,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      expect(await guard(loc('/test', 'cms-page'), FROM)).toBe('/home');
      expect(await guard(loc('/test/foo', 'cms-page'), FROM)).toBe('/home');
      expect(await guard(loc('/other', 'cms-page'), FROM)).toBeUndefined();
    });

    it('path_prefix with empty match_value never matches', async () => {
      const api = makeApi([
        { name: 'p', is_active: true, priority: 0, match_type: 'path_prefix',
          match_value: '', target_slug: '/home', redirect_code: 302,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      expect(await guard(loc('/anything', 'cms-page'), FROM)).toBeUndefined();
    });

    it('path_exact matches the exact path only, not sibling prefixes (S120)', async () => {
      const api = makeApi([
        { name: 'e', is_active: true, priority: 0, match_type: 'path_exact',
          match_value: '/home', target_slug: '/', redirect_code: 301,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      expect(await guard(loc('/home', 'cms-page'), FROM)).toBe('/');
      // must NOT catch the /home2 demo page (the reason path_exact exists)
      expect(await guard(loc('/home2', 'cms-page'), FROM)).toBeUndefined();
      expect(await guard(loc('/homepage', 'cms-page'), FROM)).toBeUndefined();
    });

    it('path_exact with empty match_value never matches', async () => {
      const api = makeApi([
        { name: 'e', is_active: true, priority: 0, match_type: 'path_exact',
          match_value: '', target_slug: '/', redirect_code: 301,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      expect(await guard(loc('/', 'home'), FROM)).toBeUndefined();
    });

    it('cookie matcher matches an exact key=value', async () => {
      Object.defineProperty(document, 'cookie', { writable: true, value: 'vbwd_lang=de' });
      const api = makeApi([
        { name: 'c', is_active: true, priority: 0, match_type: 'cookie',
          match_value: 'vbwd_lang=de', target_slug: '/de/home', redirect_code: 302,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      expect(await guard(loc('/', 'home'), FROM)).toBe('/de/home');
    });

    it('ignores ip_range and country rules client-side', async () => {
      const api = makeApi([
        { name: 'ip', is_active: true, priority: 0, match_type: 'ip_range',
          match_value: '0.0.0.0/0', target_slug: '/home', redirect_code: 302,
          is_rewrite: false, layer: 'middleware' },
        { name: 'co', is_active: true, priority: 1, match_type: 'country',
          match_value: 'DE', target_slug: '/home', redirect_code: 302,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      expect(await guard(loc('/test', 'cms-page'), FROM)).toBeUndefined();
    });
  });

  describe('priority + filtering', () => {
    it('respects priority — lower number wins first match', async () => {
      const api = makeApi([
        { name: 'low-prio', is_active: true, priority: 100, match_type: 'path_prefix',
          match_value: '/test', target_slug: '/page-100', redirect_code: 302,
          is_rewrite: false, layer: 'middleware' },
        { name: 'high-prio', is_active: true, priority: 0, match_type: 'path_prefix',
          match_value: '/test', target_slug: '/page-0', redirect_code: 302,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      expect(await guard(loc('/test', 'cms-page'), FROM)).toBe('/page-0');
    });

    it('skips inactive rules', async () => {
      const api = makeApi([
        { name: 'off', is_active: false, priority: 0, match_type: 'path_prefix',
          match_value: '/test', target_slug: '/home', redirect_code: 302,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      expect(await guard(loc('/test', 'cms-page'), FROM)).toBeUndefined();
    });
  });

  describe('loop guard', () => {
    it('does not redirect when target equals current path', async () => {
      const api = makeApi([
        { name: 'p', is_active: true, priority: 0, match_type: 'path_prefix',
          match_value: '/home', target_slug: '/home', redirect_code: 302,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      expect(await guard(loc('/home', 'cms-page'), FROM)).toBeUndefined();
    });

    it('normalises bare slug to leading-slash and compares', async () => {
      const api = makeApi([
        { name: 'p', is_active: true, priority: 0, match_type: 'path_prefix',
          match_value: '/home', target_slug: 'home', redirect_code: 302,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      // target normalises to /home, equals to.path → no-op
      expect(await guard(loc('/home', 'cms-page'), FROM)).toBeUndefined();
    });

    it('strips trailing slash from target_slug so /home/ → /home', async () => {
      // Regression for the 2026-05-29 cascade: a rule whose author wrote
      // target_slug `/home/` was being passed verbatim to vue-router →
      // /home redirected to /home/ → CmsPage fetched literal slug
      // `home/` → backend 404. Normaliser must strip the trailing slash.
      const api = makeApi([
        { name: 'p', is_active: true, priority: 0, match_type: 'path_prefix',
          match_value: '/test', target_slug: '/home/', redirect_code: 302,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      expect(await guard(loc('/test', 'cms-page'), FROM)).toBe('/home');
    });

    it('preserves root `/` target (does not strip the only slash)', async () => {
      const api = makeApi([
        { name: 'p', is_active: true, priority: 0, match_type: 'path_prefix',
          match_value: '/legacy', target_slug: '/', redirect_code: 302,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      expect(await guard(loc('/legacy', 'cms-page'), FROM)).toBe('/');
    });

    it('with target /home/ + current /home, loop guard short-circuits (no 404 cascade)', async () => {
      // Same rule as above (target_slug `/home/`) but visiting /home
      // directly — after normalisation the target is `/home`, equal to
      // current → guard returns undefined and CmsPage renders home.
      const api = makeApi([
        { name: 'p', is_active: true, priority: 0, match_type: 'path_prefix',
          match_value: '/', target_slug: '/home/', redirect_code: 302,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      expect(await guard(loc('/home', 'cms-page'), FROM)).toBeUndefined();
    });
  });

  describe('redirect chain resolution + loop safety', () => {
    it('resolves a multi-hop chain to its final target', async () => {
      // /a → /b → /c, where /c matches no rule. The guard must follow the
      // whole chain in one navigation and return the final /c, not /b.
      const api = makeApi([
        { name: 'a', is_active: true, priority: 0, match_type: 'path_exact',
          match_value: '/a', target_slug: '/b', redirect_code: 301,
          is_rewrite: false, layer: 'middleware' },
        { name: 'b', is_active: true, priority: 0, match_type: 'path_exact',
          match_value: '/b', target_slug: '/c', redirect_code: 301,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      expect(await guard(loc('/a', 'cms-page'), FROM)).toBe('/c');
    });

    it('breaks a 2-cycle and does NOT redirect (renders the requested path)', async () => {
      // The prod incident: a permalink-double rule forwards the real slug to a
      // doubled path, and another rule sends the doubled path back — an
      // infinite A→B→A loop that hung the SPA. The guard must detect the cycle
      // and return undefined so the originally-requested post renders.
      const real = '/blog/2026/vbwd/ship-x';
      const doubled = '/blog/2026/vbwd/blog/2026/vbwd/ship-x';
      const api = makeApi([
        { name: 'fwd', is_active: true, priority: 0, match_type: 'path_exact',
          match_value: real, target_slug: doubled, redirect_code: 301,
          is_rewrite: false, layer: 'middleware' },
        { name: 'back', is_active: true, priority: 0, match_type: 'path_exact',
          match_value: doubled, target_slug: real, redirect_code: 301,
          is_rewrite: false, layer: 'middleware' },
      ]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      expect(await guard(loc(real, 'cms-page'), FROM)).toBeUndefined();
    });

    it('caps a runaway chain via maxRedirectHops (no hang)', async () => {
      // A long chain of distinct rules /s0→/s1→…→/s9 never repeats a path, so
      // the visited-set cycle check cannot catch it. The hop cap must abort and
      // fail safe (undefined) rather than follow the chain forever — this is
      // the accumulated-doubled-rules shape seen on prod.
      const api = makeApi(
        Array.from({ length: 10 }, (_, i) => ({
          name: `s${i}`, is_active: true, priority: 0, match_type: 'path_exact',
          match_value: `/s${i}`, target_slug: `/s${i + 1}`, redirect_code: 301,
          is_rewrite: false, layer: 'middleware',
        })),
      );
      const guard = createCmsMiddlewareRoutingGuard(api, { maxRedirectHops: 5 });

      expect(await guard(loc('/s0', 'cms-page'), FROM)).toBeUndefined();
    });

    it('de-duplicates concurrent in-flight fetches (single request)', async () => {
      // Before this fix, cachedRules was only populated after the await
      // resolved, so navigations firing while a request was pending each
      // issued a fresh GET — the pile of pending `middleware` XHRs on prod.
      let resolveFetch: (v: unknown) => void = () => {};
      const api = {
        get: vi.fn(
          () => new Promise((resolve) => { resolveFetch = resolve; }),
        ),
      };
      const guard = createCmsMiddlewareRoutingGuard(api);

      const p1 = guard(loc('/a', 'cms-page'), FROM);
      const p2 = guard(loc('/b', 'cms-page'), FROM);
      resolveFetch([]);
      await Promise.all([p1, p2]);

      expect(api.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('caching + resilience', () => {
    it('fetches once across multiple navigations within TTL', async () => {
      const api = makeApi([]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      await guard(loc('/a', 'cms-page'), FROM);
      await guard(loc('/b', 'cms-page'), FROM);
      await guard(loc('/c', 'cms-page'), FROM);

      expect(api.get).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after TTL expires', async () => {
      const api = makeApi([]);
      let nowValue = 1_000_000;
      const guard = createCmsMiddlewareRoutingGuard(api, {
        cacheTtlMs: 1000,
        now: () => nowValue,
      });

      await guard(loc('/a', 'cms-page'), FROM);
      expect(api.get).toHaveBeenCalledTimes(1);

      nowValue += 1500; // past TTL
      await guard(loc('/b', 'cms-page'), FROM);
      expect(api.get).toHaveBeenCalledTimes(2);
    });

    it('treats fetch failure as empty rule set (does not block navigation)', async () => {
      const api = {
        get: vi.fn(async () => { throw new Error('network'); }),
      };
      const guard = createCmsMiddlewareRoutingGuard(api);

      expect(await guard(loc('/test', 'cms-page'), FROM)).toBeUndefined();
    });
  });

  describe('tab-focus cache invalidation', () => {
    it('re-fetches on visibilitychange when the tab becomes visible', async () => {
      const api = makeApi([]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      // Prime the cache
      await guard(loc('/a', 'cms-page'), FROM);
      expect(api.get).toHaveBeenCalledTimes(1);

      // Simulate tab regaining focus
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));

      await guard(loc('/b', 'cms-page'), FROM);
      expect(api.get).toHaveBeenCalledTimes(2);
    });

    it('does NOT re-fetch on visibilitychange when the tab becomes hidden', async () => {
      const api = makeApi([]);
      const guard = createCmsMiddlewareRoutingGuard(api);

      await guard(loc('/a', 'cms-page'), FROM);
      expect(api.get).toHaveBeenCalledTimes(1);

      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));

      await guard(loc('/b', 'cms-page'), FROM);
      // Still cached — no extra fetch
      expect(api.get).toHaveBeenCalledTimes(1);
    });
  });
});
