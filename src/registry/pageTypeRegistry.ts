/**
 * CMS page-type renderer registry.
 *
 * A cms_post carries a `type` (`page` | `post`, or a plugin-defined type such
 * as `video`). `CmsPage.vue` is a thin dispatcher: it resolves the `type` to a
 * Vue component registered here and renders it. cms ships `page` + `post`;
 * extension plugins (e.g. a video plugin → `CmsPageTypeVideo`) call
 * `registerCmsPageType` from their `install()` — cms/core stays untouched (OCP).
 *
 * The registry is REACTIVE: a type whose plugin loads AFTER the dispatcher first
 * mounts must not stay stuck on the fallback. We back the map with a Vue `ref`
 * version counter that `resolveCmsPageType` reads, so the dispatcher re-resolves
 * when a late registration bumps the counter.
 *
 * Unknown type → `undefined` (never throws) so the dispatcher falls back to the
 * generic `page` type (Liskov: an unregistered type degrades, it does not break
 * the page).
 */
import { ref, type Component } from 'vue';

const registry = new Map<string, Component>();

/** Reactive version counter — read on resolve, bumped on every mutation. */
const registryVersion = ref(0);

export function registerCmsPageType(slug: string, component: Component): void {
  registry.set(slug, component);
  registryVersion.value += 1;
}

export function resolveCmsPageType(slug: string): Component | undefined {
  // Touch the reactive version so callers re-render on a late registration.
  void registryVersion.value;
  return registry.get(slug);
}

/**
 * Remove a single page type (e.g. an extension plugin being disabled). Narrow
 * teardown that leaves every other registration — including cms's built-in
 * `page` / `post` — untouched (no cms change).
 */
export function unregisterCmsPageType(slug: string): void {
  if (registry.delete(slug)) {
    registryVersion.value += 1;
  }
}

/** Test-only: clear all registrations (keeps the reactive seam intact). */
export function resetCmsPageTypes(): void {
  registry.clear();
  registryVersion.value += 1;
}
