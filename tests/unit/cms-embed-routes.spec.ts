import { describe, it, expect, vi } from 'vitest';
import type { IPlatformSDK } from 'vbwd-view-component';

// The plugin install() registers vue-component widgets via dynamic imports and a
// router guard against the host api; mock the host api so install() is a pure
// in-memory route collection.
vi.mock('@/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

import { cmsPlugin } from '../../index';

interface CapturedRoute {
  path: string;
  name: string;
  component: unknown;
  meta?: Record<string, unknown>;
}

function installAndCollectRoutes(): CapturedRoute[] {
  const routes: CapturedRoute[] = [];
  const sdk = {
    addRoute: (route: CapturedRoute) => routes.push(route),
    addTranslations: () => undefined,
    addRouterGuard: () => undefined,
    createStore: () => undefined,
  } as unknown as IPlatformSDK;

  cmsPlugin.install?.(sdk);
  return routes;
}

describe('cms plugin embed route registration', () => {
  it('registers the chrome-light embed archive route with embed meta', () => {
    const routes = installAndCollectRoutes();
    const archive = routes.find((route) => route.path === '/cms/embed/:type/:category');

    expect(archive).toBeDefined();
    expect(archive?.meta).toMatchObject({ requiresAuth: false, embed: true });
    // Embed routes must NOT use the full-chrome cmsLayout path.
    expect(archive?.meta?.cmsLayout).toBeUndefined();
  });

  it('registers the embed detail route pointing at the existing CmsPage dispatcher', () => {
    const routes = installAndCollectRoutes();
    const detail = routes.find((route) => route.path === '/cms/embed/:type/post/:slug');

    expect(detail).toBeDefined();
    expect(detail?.meta).toMatchObject({ requiresAuth: false, embed: true });
    // The detail route reuses the dispatcher (CmsPage.vue) — lazy import factory.
    expect(typeof detail?.component).toBe('function');
  });

  it('registers the embed detail route BEFORE the /:slug(.+) catch-all (no shadowing)', () => {
    const routes = installAndCollectRoutes();
    const detailIndex = routes.findIndex((route) => route.path === '/cms/embed/:type/post/:slug');
    const archiveIndex = routes.findIndex((route) => route.path === '/cms/embed/:type/:category');
    const catchAllIndex = routes.findIndex((route) => route.path === '/:slug(.+)');

    expect(detailIndex).toBeGreaterThanOrEqual(0);
    expect(archiveIndex).toBeGreaterThanOrEqual(0);
    expect(catchAllIndex).toBeGreaterThanOrEqual(0);
    expect(detailIndex).toBeLessThan(catchAllIndex);
    expect(archiveIndex).toBeLessThan(catchAllIndex);
    // The more specific detail route is registered before the archive route so
    // /cms/embed/<t>/post/<slug> never resolves to the archive's :category.
    expect(detailIndex).toBeLessThan(archiveIndex);
  });
});
