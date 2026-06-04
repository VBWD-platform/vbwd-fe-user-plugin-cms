/**
 * S47.3 — content-type renderer registry.
 *
 * A post body is an ordered list of typed blocks (`content_json.blocks`).
 * Each block `type` maps to a Vue component registered here, plus a
 * `placement` hint (`top` / `inline` / `bottom`) that PostDetail uses to order
 * the render zones. Extension plugins (e.g. `cms-youtube`) call
 * `registerPostContentType` from their `install()` — cms/core untouched (OCP).
 *
 * The registry is REACTIVE: a block whose plugin loads AFTER PostDetail first
 * mounts must not stay stuck on the unsupported-block fallback. We back the map
 * with a Vue `ref` version counter that `resolvePostContentType` reads, so any
 * component calling it re-evaluates when a late registration bumps the counter.
 *
 * Unknown type → `undefined` (never throws) so the caller renders a quiet
 * fallback (Liskov: an unsupported block degrades, it does not break the page).
 */
import { ref, type Component } from 'vue';

export type PostContentPlacement = 'top' | 'inline' | 'bottom';

export interface PostContentTypeEntry {
  component: Component;
  placement: PostContentPlacement;
}

const registry = new Map<string, PostContentTypeEntry>();

/** Reactive version counter — read on resolve, bumped on every mutation. */
const registryVersion = ref(0);

export function registerPostContentType(
  type: string,
  component: Component,
  options?: { placement?: PostContentPlacement },
): void {
  registry.set(type, {
    component,
    placement: options?.placement ?? 'inline',
  });
  registryVersion.value += 1;
}

export function resolvePostContentType(
  type: string,
): PostContentTypeEntry | undefined {
  // Touch the reactive version so callers re-render on a late registration.
  void registryVersion.value;
  return registry.get(type);
}

/**
 * Remove a single content type (e.g. an extension plugin being disabled).
 * Narrow teardown that leaves every other registration — including cms's
 * built-in `richtext` — untouched (no cms change).
 */
export function unregisterPostContentType(type: string): void {
  if (registry.delete(type)) {
    registryVersion.value += 1;
  }
}

/** Test-only: clear all registrations (keeps the reactive seam intact). */
export function resetPostContentTypes(): void {
  registry.clear();
  registryVersion.value += 1;
}
