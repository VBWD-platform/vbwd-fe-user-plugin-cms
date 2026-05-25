/**
 * Prefetch CMS pages whose links are visible in the viewport — anywhere in the
 * CMS layout (widgets AND main content). When a local CMS link scrolls into
 * view, warm its page (JSON + layout + style CSS) into the store cache so a
 * later click is instant. Agnostic to the link's source; deduped via the cache;
 * skipped under Save-Data / 2g and where IntersectionObserver is unavailable.
 */
import { onMounted, onUnmounted, watch, type Ref } from 'vue';
import { useRouter, type Router } from 'vue-router';
import { classifyLink } from '../utils/cmsLinkResolver';
import { useCmsStore } from '../stores/useCmsStore';

/** Slug to prefetch for this href, or null when it isn't a local CMS link. */
export function prefetchSlugFor(href: string | null, router: Router): string | null {
  const link = classifyLink(href, router);
  return link.kind === 'cms' && link.slug ? link.slug : null;
}

function dataSaverOn(): boolean {
  const connection = (navigator as unknown as { connection?: Record<string, unknown> })
    ?.connection;
  if (!connection) return false;
  return (
    Boolean(connection.saveData) ||
    /(^|-)2g$/.test(String(connection.effectiveType || ''))
  );
}

export interface CmsLinkPrefetchDeps {
  router?: Router;
  prefetch?: (slug: string) => void;
  createObserver?: (callback: IntersectionObserverCallback) => IntersectionObserver;
  scheduleIdle?: (task: () => void) => void;
}

function defaultScheduleIdle(task: () => void): void {
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
    .requestIdleCallback;
  if (typeof idle === 'function') idle(task);
  else setTimeout(task, 0);
}

export function useCmsLinkPrefetch(
  containerRef: Ref<HTMLElement | null | undefined>,
  deps: CmsLinkPrefetchDeps = {},
): void {
  const router = deps.router ?? useRouter();
  const store = useCmsStore();
  const prefetch = deps.prefetch ?? ((slug: string) => store.prefetchPage(slug));
  const scheduleIdle = deps.scheduleIdle ?? defaultScheduleIdle;

  let observer: IntersectionObserver | null = null;

  function onIntersect(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const anchor = entry.target as HTMLAnchorElement;
      observer?.unobserve(anchor); // prefetch each link once
      const slug = prefetchSlugFor(anchor.getAttribute('href'), router);
      if (slug) scheduleIdle(() => prefetch(slug));
    }
  }

  function observeAnchors(): void {
    const root = containerRef.value;
    if (!root || !observer) return;
    root.querySelectorAll('a[href]').forEach((anchor) => observer!.observe(anchor));
  }

  onMounted(() => {
    if (typeof IntersectionObserver === 'undefined' || dataSaverOn()) return;
    const create =
      deps.createObserver ??
      ((callback: IntersectionObserverCallback) =>
        new IntersectionObserver(callback, { rootMargin: '200px' }));
    observer = create(onIntersect);
    observeAnchors();
  });

  // Re-observe when the rendered page changes (new anchors appear).
  watch(
    () => store.currentPage,
    () => setTimeout(observeAnchors, 0),
  );

  onUnmounted(() => observer?.disconnect());
}
