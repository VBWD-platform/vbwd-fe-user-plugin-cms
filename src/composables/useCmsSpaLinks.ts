/**
 * Convert clicks on local CMS links (anywhere in the CMS layout — widgets AND
 * main content) into in-SPA navigation, so they don't trigger a full page
 * reload (and so prefetched pages render instantly). One delegated listener on
 * the layout root; agnostic to where the link came from.
 */
import { onMounted, onUnmounted, type Ref } from 'vue';
import { useRouter, type Router } from 'vue-router';
import { classifyLink } from '../utils/cmsLinkResolver';

export function isPlainLeftClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/**
 * Path to SPA-navigate to for this anchor, or null to let the browser handle
 * it natively (external, app route, hash, `target=_blank`, download…).
 */
export function resolveAnchorNavigation(
  anchor: HTMLAnchorElement,
  router: Router,
): string | null {
  const target = anchor.getAttribute('target');
  if (target && target !== '_self') return null;
  if (anchor.hasAttribute('download')) return null;
  const link = classifyLink(anchor.getAttribute('href'), router);
  return link.kind === 'cms' ? link.path ?? null : null;
}

export interface CmsSpaLinksDeps {
  router?: Router;
}

export function useCmsSpaLinks(
  containerRef: Ref<HTMLElement | null | undefined>,
  deps: CmsSpaLinksDeps = {},
): void {
  const router = deps.router ?? useRouter();

  function onClick(event: MouseEvent): void {
    if (event.defaultPrevented || !isPlainLeftClick(event)) return;
    const anchor = (event.target as HTMLElement | null)?.closest('a');
    if (!anchor) return;
    const path = resolveAnchorNavigation(anchor as HTMLAnchorElement, router);
    if (!path) return;
    event.preventDefault();
    router.push(path);
  }

  onMounted(() => containerRef.value?.addEventListener('click', onClick));
  onUnmounted(() => containerRef.value?.removeEventListener('click', onClick));
}
