/**
 * Classify an href relative to this CMS app — the single source of truth for
 * "is this a local CMS link?". Used by both the prefetch and SPA-navigation
 * composables. Pure: a function of (href, router), no side effects.
 */
import type { Router } from 'vue-router';

export type CmsLinkKind = 'cms' | 'app' | 'external' | 'hash' | 'invalid';

export interface ClassifiedCmsLink {
  kind: CmsLinkKind;
  path?: string;
  slug?: string;
}

const EXPLICIT_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function classifyPath(path: string, router: Router): ClassifiedCmsLink {
  try {
    const resolved = router.resolve(path);
    if (resolved.name === 'cms-page') {
      const slug = String((resolved.params as Record<string, unknown>).slug ?? '')
        .replace(/^\/+/, '');
      return { kind: 'cms', path, slug };
    }
    return { kind: 'app', path };
  } catch {
    return { kind: 'invalid' };
  }
}

export function classifyLink(
  href: string | null | undefined,
  router: Router,
): ClassifiedCmsLink {
  if (!href) return { kind: 'invalid' };
  const trimmed = href.trim();
  if (!trimmed || trimmed === '#') return { kind: 'invalid' };
  if (trimmed.startsWith('#')) return { kind: 'hash' };

  // Absolute http(s): same-origin → classify by path; cross-origin → external.
  if (/^https?:\/\//i.test(trimmed)) {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    try {
      const url = new URL(trimmed, origin);
      if (url.origin !== origin) return { kind: 'external' };
      return classifyPath(url.pathname + url.search, router);
    } catch {
      return { kind: 'invalid' };
    }
  }

  // Local absolute path.
  if (trimmed.startsWith('/')) return classifyPath(trimmed, router);

  // Any other explicit scheme (mailto:, tel:, javascript:, …) → external.
  if (EXPLICIT_SCHEME.test(trimmed)) return { kind: 'external' };

  // Relative or bare → treat as non-local (safe default).
  return { kind: 'external' };
}
