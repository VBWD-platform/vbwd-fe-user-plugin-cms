import { describe, it, expect, beforeEach } from 'vitest';
import {
  readSeoHandoff,
  injectSeoMeta,
  SEO_SSR_MARKER,
} from '../../src/composables/useSeoHandoff';

function setHandoffPayload(payload: unknown) {
  const script = document.createElement('script');
  script.type = 'application/json';
  script.id = '__POST__';
  script.textContent = JSON.stringify(payload);
  document.body.appendChild(script);
}

describe('readSeoHandoff', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('returns the parsed post state from the inlined #__POST__ payload', () => {
    setHandoffPayload({
      slug: 'pricing',
      title: 'Pricing',
      content_html: '<p>Plans</p>',
      seo: { robots: 'index,follow', canonical_url: 'https://x/pricing' },
    });

    const state = readSeoHandoff();
    expect(state).not.toBeNull();
    expect(state?.slug).toBe('pricing');
    expect(state?.title).toBe('Pricing');
    expect(state?.content_html).toBe('<p>Plans</p>');
    expect(state?.seo?.canonical_url).toBe('https://x/pricing');
  });

  it('returns null when #__POST__ is absent (cold SPA route)', () => {
    expect(readSeoHandoff()).toBeNull();
  });

  it('returns null when #__POST__ holds invalid JSON (defensive)', () => {
    const script = document.createElement('script');
    script.type = 'application/json';
    script.id = '__POST__';
    script.textContent = '{not json';
    document.body.appendChild(script);

    expect(readSeoHandoff()).toBeNull();
  });
});

describe('injectSeoMeta — idempotent / update-in-place', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.title = '';
  });

  const page = {
    name: 'Pricing',
    meta_title: 'Pricing — Best Plans',
    meta_description: 'Our plans',
    robots: 'index,follow',
    canonical_url: 'https://x/pricing',
    og_title: 'OG Pricing',
    og_image_url: 'https://x/og.png',
  };

  it('sets the document title and injects marked tags', () => {
    injectSeoMeta(page);

    expect(document.title).toBe('Pricing — Best Plans');
    const desc = document.head.querySelector(
      `meta[name="description"][${SEO_SSR_MARKER}]`,
    );
    expect(desc?.getAttribute('content')).toBe('Our plans');
    const canonical = document.head.querySelector(
      `link[rel="canonical"][${SEO_SSR_MARKER}]`,
    );
    expect(canonical?.getAttribute('href')).toBe('https://x/pricing');
  });

  it('updates an EXISTING server-emitted tag in place (no duplicate)', () => {
    // Simulate the prerendered server-side meta tag carrying data-seo="ssr".
    const ssrDesc = document.createElement('meta');
    ssrDesc.setAttribute('name', 'description');
    ssrDesc.setAttribute('content', 'OLD server description');
    ssrDesc.setAttribute('data-seo', 'ssr');
    document.head.appendChild(ssrDesc);

    injectSeoMeta(page);

    const descTags = document.head.querySelectorAll('meta[name="description"]');
    expect(descTags.length).toBe(1);
    expect(descTags[0].getAttribute('content')).toBe('Our plans');
  });

  it('does not duplicate tags across repeated injections', () => {
    injectSeoMeta(page);
    injectSeoMeta(page);

    expect(document.head.querySelectorAll('meta[name="description"]').length).toBe(1);
    expect(document.head.querySelectorAll('link[rel="canonical"]').length).toBe(1);
    expect(document.head.querySelectorAll('meta[property="og:title"]').length).toBe(1);
  });

  it('removes stale tags when a field becomes empty on a later page', () => {
    injectSeoMeta(page);
    expect(document.head.querySelectorAll('meta[property="og:image"]').length).toBe(1);

    injectSeoMeta({ name: 'Other', meta_title: 'Other' });

    expect(document.head.querySelectorAll('meta[property="og:image"]').length).toBe(0);
    expect(document.title).toBe('Other');
  });
});
