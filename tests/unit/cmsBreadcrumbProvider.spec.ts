/**
 * The CMS plugin's install() must register a breadcrumb provider with the core
 * (order 100) whose `resolve(route)` yields the blog trail for a post route,
 * driven by the CMS store's `currentPage`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// A real in-memory provider registry standing in for the (as-yet-unbuilt) core
// seam, so the test asserts the plugin actually registers through it.
const registry = vi.hoisted(() => ({ providers: [] as unknown[] }));

vi.mock('@/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('@/plugins/brandActionsRegistry', () => ({
  brandActionsRegistry: { register: vi.fn(), unregister: vi.fn() },
}));

const currentPageRef: { value: Record<string, unknown> | null } = { value: null };
vi.mock('../../src/stores/useCmsStore', () => ({
  useCmsStore: () => ({ get currentPage() { return currentPageRef.value; } }),
}));

vi.mock('vbwd-view-component', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    registerBreadcrumbProvider: (provider: unknown) => registry.providers.push(provider),
    getBreadcrumbProviders: () => registry.providers,
  };
});

import { cmsPlugin } from '../../index';
import { getBreadcrumbProviders } from 'vbwd-view-component';

interface BreadcrumbProviderLike {
  order?: number;
  resolve: (route: { path: string }) => Array<{ label: string; to?: string; current?: boolean }> | null;
}

function installPlugin() {
  const sdk = {
    addRoute: () => undefined,
    addTranslations: () => undefined,
    addRouterGuard: () => undefined,
    createStore: () => undefined,
  } as never;
  cmsPlugin.install?.(sdk);
}

describe('cms plugin — breadcrumb provider registration', () => {
  beforeEach(() => {
    registry.providers.length = 0;
    currentPageRef.value = null;
  });

  it('registers a provider (order 100) that resolves the blog trail for a post route', () => {
    installPlugin();

    const providers = getBreadcrumbProviders() as BreadcrumbProviderLike[];
    expect(providers.length).toBeGreaterThan(0);

    const cmsProvider = providers.find((provider) => provider.order === 100);
    expect(cmsProvider).toBeDefined();

    currentPageRef.value = { type: 'post', title: 'Hello World' };
    const trail = cmsProvider!.resolve({ path: '/blog/2026/news/hello-world' });

    expect(trail).toEqual([
      { label: 'Home', to: '/' },
      { label: 'Blog', to: '/blog' },
      { label: '2026', to: '/blog/2026' },
      { label: 'News', to: '/blog/2026/news' },
      { label: 'Hello World', current: true },
    ]);
  });

  it('the registered provider returns null for a non-CMS route (no page)', () => {
    installPlugin();
    const cmsProvider = (getBreadcrumbProviders() as BreadcrumbProviderLike[]).find(
      (provider) => provider.order === 100,
    );
    currentPageRef.value = null;
    expect(cmsProvider!.resolve({ path: '/dashboard' })).toBeNull();
  });
});
