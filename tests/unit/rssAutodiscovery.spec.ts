import { describe, it, expect, beforeEach } from 'vitest';
import {
  injectRssAutodiscovery,
  rssFeedHref,
  SEO_SSR_MARKER,
} from '../../src/composables/useSeoHandoff';

const RSS_TYPE = 'application/rss+xml';

function alternateLinks(): HTMLLinkElement[] {
  return Array.from(
    document.head.querySelectorAll<HTMLLinkElement>(
      `link[rel="alternate"][type="${RSS_TYPE}"]`,
    ),
  );
}

describe('rssFeedHref — builds the feed URL', () => {
  it('points at the whole blog by default', () => {
    expect(rssFeedHref({})).toBe('/api/v1/cms/rss.xml?type=post');
  });

  it('honours an explicit post type', () => {
    expect(rssFeedHref({ type: 'article' })).toBe(
      '/api/v1/cms/rss.xml?type=article',
    );
  });

  it('adds term_type + term_slug for a per-term feed', () => {
    expect(
      rssFeedHref({ type: 'post', termType: 'category', termSlug: 'news' }),
    ).toBe('/api/v1/cms/rss.xml?type=post&term_type=category&term_slug=news');
  });

  it('escapes term slugs with special characters', () => {
    const href = rssFeedHref({ termType: 'tag', termSlug: 'a b&c' });
    // URLSearchParams form-encodes: space → '+', '&' → '%26'.
    expect(href).toContain('term_slug=a+b%26c');
  });
});

describe('injectRssAutodiscovery — head <link rel="alternate">', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('emits an RSS alternate link with the right type, title and href', () => {
    injectRssAutodiscovery([
      { title: 'Blog feed', href: '/api/v1/cms/rss.xml?type=post' },
    ]);

    const links = alternateLinks();
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('type')).toBe(RSS_TYPE);
    expect(links[0].getAttribute('title')).toBe('Blog feed');
    expect(links[0].getAttribute('href')).toBe('/api/v1/cms/rss.xml?type=post');
    expect(links[0].getAttribute(SEO_SSR_MARKER)).toBe('ssr');
  });

  it('does not duplicate the same feed across repeated injections', () => {
    const feed = { title: 'Blog feed', href: '/api/v1/cms/rss.xml?type=post' };
    injectRssAutodiscovery([feed]);
    injectRssAutodiscovery([feed]);
    expect(alternateLinks().length).toBe(1);
  });

  it('supports multiple distinct feeds (blog + current term)', () => {
    injectRssAutodiscovery([
      { title: 'Blog feed', href: '/api/v1/cms/rss.xml?type=post' },
      {
        title: 'News feed',
        href: '/api/v1/cms/rss.xml?type=post&term_type=category&term_slug=news',
      },
    ]);
    const hrefs = alternateLinks().map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/api/v1/cms/rss.xml?type=post');
    expect(hrefs).toContain(
      '/api/v1/cms/rss.xml?type=post&term_type=category&term_slug=news',
    );
  });

  it('removes stale RSS links when navigating to a page with no feed', () => {
    injectRssAutodiscovery([
      { title: 'Blog feed', href: '/api/v1/cms/rss.xml?type=post' },
    ]);
    expect(alternateLinks().length).toBe(1);

    injectRssAutodiscovery([]);
    expect(alternateLinks().length).toBe(0);
  });

  it('replaces a previous term feed when the term changes', () => {
    injectRssAutodiscovery([
      {
        title: 'News',
        href: '/api/v1/cms/rss.xml?type=post&term_type=category&term_slug=news',
      },
    ]);
    injectRssAutodiscovery([
      {
        title: 'Sport',
        href: '/api/v1/cms/rss.xml?type=post&term_type=category&term_slug=sport',
      },
    ]);
    const hrefs = alternateLinks().map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual([
      '/api/v1/cms/rss.xml?type=post&term_type=category&term_slug=sport',
    ]);
  });
});
