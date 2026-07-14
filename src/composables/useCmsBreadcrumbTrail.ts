/**
 * Pure trail builder behind the CMS breadcrumb provider.
 *
 * The CMS plugin registers a `BreadcrumbProvider` with the core `VbwdBreadcrumb`
 * component; that provider delegates to {@link buildCmsBreadcrumbTrail}. Keeping
 * the logic a pure function of `(route, page, opts)` makes it trivially
 * unit-testable and lets the future tarif / ghrm / booking providers own their
 * own routes without this one hijacking them.
 *
 * Activation (return a trail rather than `null`):
 *   - a blog POST permalink              → `page.type === 'post'`
 *   - a prefix archive listing            → `page.type === 'archive'` (marked by
 *                                            the store's `_resolvePrefixArchive`)
 *   - any other CMS page WITH a title     → minimal `[Home, {title, current}]`
 *   - no page at all (non-CMS route)      → `null` (other providers may answer)
 *
 * For the blog space the trail is built from the raw URL segments: every segment
 * links to its cumulative prefix (`/blog`, `/blog/2026`, …) — those prefixes now
 * resolve to a backend archive listing — and only the last crumb is `current`
 * (the real post title for a post, the title-cased segment otherwise).
 */
import { getBreadcrumbLabel } from './useBreadcrumbLabel';

/** Mirrors the core `Crumb` contract (`{ label; to?; current? }`). */
export interface Crumb {
  label: string;
  to?: string;
  current?: boolean;
}

/** The minimal route shape the trail builder reads. */
interface RouteLike {
  path: string;
}

/** A taxonomy term as attached to a resolved post (subset used here). */
interface PageTerm {
  term_type?: string;
  slug: string;
  name: string;
}

/** The subset of the CMS store's `currentPage` the trail builder reads. */
interface CmsPageLike {
  type?: string;
  title?: string;
  name?: string;
  archive_prefix?: string;
  terms?: PageTerm[];
}

/** Options: the leading "Home" crumb label + target. */
export interface CmsBreadcrumbTrailOptions {
  rootName?: string;
  rootTo?: string;
}

const DEFAULT_ROOT_NAME = 'Home';
const DEFAULT_ROOT_TO = '/';

/** Title-case a URL slug segment: `my-cat` → `My Cat`, `2026` → `2026`. */
export function slugToLabel(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/** True when the resolved page occupies the blog/post permalink or archive space. */
function isBlogSpace(page: CmsPageLike | null): boolean {
  return !!page && (page.type === 'post' || page.type === 'archive' || !!page.archive_prefix);
}

/** Prefer a matching category term's display name over the title-cased segment. */
function labelForSegment(segment: string, page: CmsPageLike | null): string {
  const term = page?.terms?.find(
    (candidate) =>
      (candidate.term_type === 'category' || !candidate.term_type) &&
      (candidate.slug === segment || candidate.slug.split('/').pop() === segment),
  );
  return term?.name ?? slugToLabel(segment);
}

/**
 * Build the CMS breadcrumb trail for a route, or `null` when the CMS plugin does
 * not own this route (so the core component can ask the next provider).
 */
export function buildCmsBreadcrumbTrail(
  route: RouteLike,
  page: CmsPageLike | null,
  options: CmsBreadcrumbTrailOptions = {},
): Crumb[] | null {
  const rootName = options.rootName ?? DEFAULT_ROOT_NAME;
  const rootTo = options.rootTo ?? DEFAULT_ROOT_TO;
  const override = getBreadcrumbLabel(route.path);

  // Blog / post permalink + prefix archive: full cumulative-prefix trail.
  if (isBlogSpace(page)) {
    const parts = route.path.replace(/^\//, '').split('/').filter(Boolean);
    const trail: Crumb[] = [{ label: rootName, to: rootTo }];

    parts.forEach((segment, index) => {
      const isLast = index === parts.length - 1;
      if (isLast) {
        const label =
          override ??
          (page?.type === 'post'
            ? page.title ?? page.name ?? slugToLabel(segment)
            : labelForSegment(segment, page));
        trail.push({ label, current: true });
        return;
      }
      trail.push({
        label: labelForSegment(segment, page),
        to: '/' + parts.slice(0, index + 1).join('/'),
      });
    });

    return trail;
  }

  // Any other CMS page with a title: minimal Home → current-title trail.
  const title = override ?? page?.title ?? page?.name;
  if (page && title) {
    return [
      { label: rootName, to: rootTo },
      { label: title, current: true },
    ];
  }

  // No CMS page — not our route.
  return null;
}
