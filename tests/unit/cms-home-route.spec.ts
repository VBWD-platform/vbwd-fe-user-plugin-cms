import { describe, it, expect, vi } from 'vitest';
import type { IPlatformSDK } from 'vbwd-view-component';

// install() registers vue-component widgets via dynamic imports and a router
// guard against the host api; mock the host api so install() is a pure
// in-memory route collection.
vi.mock('@/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

// install() registers a breadcrumb provider through the core seam. Keep every
// real fe-core export and add the (stale-in-this-tree) provider registry hook so
// install() runs without touching the actual registry.
vi.mock('vbwd-view-component', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, registerBreadcrumbProvider: vi.fn(), getBreadcrumbProviders: () => [] };
});

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

describe('cms plugin home route registration', () => {
  it('registers `/` as the `home` route so it OVERRIDES the host bouncer by name', () => {
    const routes = installAndCollectRoutes();
    const home = routes.find((route) => route.path === '/');

    expect(home).toBeDefined();
    // Same name as the host `/` route → vue-router `addRoute` replaces the host
    // bouncer with the CMS home renderer at runtime (factory install order).
    expect(home?.name).toBe('home');
  });

  it('the home route wears the full cmsLayout chrome and is public', () => {
    const routes = installAndCollectRoutes();
    const home = routes.find((route) => route.path === '/');

    expect(home?.meta).toMatchObject({ requiresAuth: false, cmsLayout: true });
    // It renders content in place — never the chrome-light embed path.
    expect(home?.meta?.embed).toBeUndefined();
    // Lazy component factory (CmsHomePage.vue).
    expect(typeof home?.component).toBe('function');
  });
});
