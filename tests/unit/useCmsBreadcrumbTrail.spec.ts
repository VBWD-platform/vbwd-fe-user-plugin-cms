/**
 * `buildCmsBreadcrumbTrail` — the pure trail-building function behind the CMS
 * breadcrumb provider. It must:
 *  - build the FULL cumulative-prefix trail for the blog/post permalink space
 *    and prefix archives (every non-current segment links to its cumulative
 *    prefix, which now resolves to a backend archive listing);
 *  - render the real post title as the current (non-link) crumb for a post;
 *  - fall back to `[Home, {title, current}]` for a normal CMS page;
 *  - return `null` for non-CMS routes so other providers can answer.
 */
import { describe, it, expect } from 'vitest';
import {
  buildCmsBreadcrumbTrail,
  slugToLabel,
} from '../../src/composables/useCmsBreadcrumbTrail';

describe('buildCmsBreadcrumbTrail', () => {
  it('builds the full cumulative-prefix trail for a blog post permalink', () => {
    const trail = buildCmsBreadcrumbTrail(
      { path: '/blog/2026/news/vbwd-v26-7-0-released' },
      { type: 'post', title: 'VBWD v26.7.0 released…' },
    );

    expect(trail).toEqual([
      { label: 'Home', to: '/' },
      { label: 'Blog', to: '/blog' },
      { label: '2026', to: '/blog/2026' },
      { label: 'News', to: '/blog/2026/news' },
      { label: 'VBWD v26.7.0 released…', current: true },
    ]);

    // Every non-current crumb (after Home) links to its cumulative prefix.
    const nonCurrent = trail!.filter((crumb) => !crumb.current);
    expect(nonCurrent.map((crumb) => crumb.to)).toEqual([
      '/',
      '/blog',
      '/blog/2026',
      '/blog/2026/news',
    ]);

    // The last crumb is current and NOT a link (no `to`).
    const last = trail![trail!.length - 1];
    expect(last.current).toBe(true);
    expect(last.to).toBeUndefined();
  });

  it('builds a prefix-archive trail with the last segment current', () => {
    const trail = buildCmsBreadcrumbTrail(
      { path: '/blog/2026' },
      { type: 'archive', archive_prefix: 'blog/2026', title: '2026' },
    );

    expect(trail).toEqual([
      { label: 'Home', to: '/' },
      { label: 'Blog', to: '/blog' },
      { label: '2026', current: true },
    ]);
  });

  it('returns a minimal [Home, current-title] trail for a normal CMS page', () => {
    const trail = buildCmsBreadcrumbTrail(
      { path: '/about' },
      { type: 'page', title: 'About Us' },
    );

    expect(trail).toEqual([
      { label: 'Home', to: '/' },
      { label: 'About Us', current: true },
    ]);
  });

  it('honours the rootName / rootTo options for the Home crumb', () => {
    const trail = buildCmsBreadcrumbTrail(
      { path: '/blog/hello' },
      { type: 'post', title: 'Hello' },
      { rootName: 'Start', rootTo: '/start' },
    );

    expect(trail![0]).toEqual({ label: 'Start', to: '/start' });
  });

  it('prefers a matching category term name over the title-cased segment', () => {
    const trail = buildCmsBreadcrumbTrail(
      { path: '/blog/2026/news/hello' },
      {
        type: 'post',
        title: 'Hello',
        terms: [{ term_type: 'category', slug: 'news', name: 'Company News' }],
      },
    );

    // The `news` segment adopts the term's display name.
    expect(trail!.find((crumb) => crumb.to === '/blog/2026/news')?.label).toBe(
      'Company News',
    );
  });

  it('returns null when there is no page (non-CMS route)', () => {
    expect(buildCmsBreadcrumbTrail({ path: '/dashboard' }, null)).toBeNull();
  });
});

describe('slugToLabel', () => {
  it('title-cases a single word', () => {
    expect(slugToLabel('news')).toBe('News');
  });

  it('title-cases a hyphenated slug', () => {
    expect(slugToLabel('my-cat')).toBe('My Cat');
  });

  it('leaves a numeric segment unchanged', () => {
    expect(slugToLabel('2026')).toBe('2026');
  });
});
