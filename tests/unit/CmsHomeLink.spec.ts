/**
 * CmsHomeLink — the CMS-owned "Home" link injected into the fe-user sidebar
 * logo block via the generic host brandActionsRegistry. It mirrors the fe-admin
 * `cms-topbar-home` button: an <a> with a home Icon + "Home" label opening the
 * public home in a new tab. The href resolves the ROUTER's named `home` route
 * WITH the `public_home=1` bypass flag so an authenticated user actually lands
 * on the public homepage instead of being bounced to the dashboard.
 *
 * Engineering requirements (binding, restated): TDD-first (this is the RED set);
 * DevOps-first (runs cold local + CI, no live backend); SOLID/DI (depends on the
 * router + i18n abstractions, and on the generic brandActionsRegistry seam — the
 * plugin OWNS the CMS rule, core stays agnostic); DRY (label via i18n `cms.home`,
 * href via the router's named route — no hardcoded `/`); Liskov (disabled CMS =
 * unregistered = no link, callers unaffected); clean code; no overengineering.
 * Quality guard: `bin/pre-commit-check.sh --plugin cms --unit`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import { createI18n } from 'vue-i18n';

import CmsHomeLink from '../../src/components/CmsHomeLink.vue';
import { brandActionsRegistry } from '@/plugins/brandActionsRegistry';
import { cmsPlugin } from '../..';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  missing: (_locale, key) => key,
  messages: { en: { cms: { home: 'Home' } } },
});

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
      { path: '/dashboard', name: 'dashboard', component: { template: '<div>Dash</div>' } },
    ],
  });
}

async function mountLink() {
  const router = makeRouter();
  router.push('/dashboard');
  await router.isReady();
  return mount(CmsHomeLink, {
    global: {
      plugins: [router, i18n],
      stubs: {
        // Render the shared Icon as a lightweight stub so the test does not
        // depend on the fe-core glyph implementation.
        Icon: { props: ['name'], template: '<span class="vbwd-icon" :data-icon="name" />' },
      },
    },
  });
}

describe('CmsHomeLink', () => {
  it('renders an <a target="_blank"> with the cms-topbar-home testid', async () => {
    const wrapper = await mountLink();
    const anchor = wrapper.get('a[data-testid="cms-topbar-home"]');
    expect(anchor.attributes('target')).toBe('_blank');
    expect(anchor.attributes('rel')).toContain('noopener');
  });

  it('resolves the href from the named home route WITH the public_home=1 flag', async () => {
    const wrapper = await mountLink();
    const href = wrapper.get('a[data-testid="cms-topbar-home"]').attributes('href');
    expect(href).toContain('public_home=1');
  });

  it('is icon-only: renders a home Icon with no visible label text', async () => {
    const wrapper = await mountLink();
    // Icon-only per the sidebar-logo design — no visible "Home" text next to it.
    expect(wrapper.text()).not.toContain('Home');
    expect(wrapper.get('.vbwd-icon').attributes('data-icon')).toBe('home');
  });

  it('keeps the accessible name on the anchor (title + aria-label)', async () => {
    const wrapper = await mountLink();
    const anchor = wrapper.get('a[data-testid="cms-topbar-home"]');
    expect(anchor.attributes('title')).toBe('Home');
    expect(anchor.attributes('aria-label')).toBe('Home');
  });

  it('publishes its home href to the brand registry on mount, clears it on unmount', async () => {
    brandActionsRegistry.setBrandHref(null);

    const wrapper = await mountLink();
    const brandHref = brandActionsRegistry.getBrandHref();
    expect(brandHref).not.toBeNull();
    expect(brandHref).toContain('public_home=1');

    wrapper.unmount();
    expect(brandActionsRegistry.getBrandHref()).toBeNull();
  });
});

describe('CMS plugin — brand action lifecycle', () => {
  beforeEach(() => {
    brandActionsRegistry.unregister('cms-home');
  });

  it('activate() registers the cms-home brand action', () => {
    cmsPlugin.activate!();
    expect(brandActionsRegistry.getAll().some((action) => action.id === 'cms-home')).toBe(true);
  });

  it('deactivate() removes the cms-home brand action', () => {
    cmsPlugin.activate!();
    cmsPlugin.deactivate!();
    expect(brandActionsRegistry.getAll().some((action) => action.id === 'cms-home')).toBe(false);
  });
});
