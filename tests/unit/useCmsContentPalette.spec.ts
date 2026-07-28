import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';

import CmsLayoutRenderer from '../../src/components/CmsLayoutRenderer.vue';
import type { CmsLayout } from '../../src/stores/useCmsStore';
import { useCmsStore } from '../../src/stores/useCmsStore';
import { extractCmsContentPalette } from '../../src/composables/useCmsContentPalette';

// A realistic slice of the server-generated CMS default (light) style: the
// theme owns `--color-*` at :root, and the `.vbwd-page` wrapper derives its
// own `--vbwd-border` from `--color-border`. The default light theme's border
// token is the soft slate #e2e8f0 — that is the value marketing stat/card
// borders are meant to follow.
const DEFAULT_STYLE_CSS = `
  :root {
    --color-border: #e2e8f0;
    --color-text: #0f172a;
    --color-surface: #ffffff;
  }
  .vbwd-page { --vbwd-border: var(--color-border, #e2e8f0); }
  .vbwd-page .vbwd-card { border: 1px solid var(--vbwd-border); }
`;

// A dark CMS style declares its own darker border at :root — the fix must stay
// theme-aware and carry whatever the resolved style owns, never a hardcode.
const DARK_STYLE_CSS = `
  :root { --color-border: #374151; --color-text: #f3f4f6; }
  .vbwd-page { --vbwd-border: var(--color-border, #e2e8f0); }
`;

const LAYOUT: CmsLayout = {
  id: 'L1',
  slug: 'marketing',
  name: 'Marketing',
  areas: [{ name: 'content', type: 'content', label: 'Main' }],
  assignments: [],
};

describe('extractCmsContentPalette', () => {
  it('extracts the --color-* palette from the style :root block', () => {
    const palette = extractCmsContentPalette(DEFAULT_STYLE_CSS);
    expect(palette['--color-border']).toBe('#e2e8f0');
    expect(palette['--color-text']).toBe('#0f172a');
    expect(palette['--color-surface']).toBe('#ffffff');
  });

  it('does NOT capture the .vbwd-page-scoped --vbwd-* tokens', () => {
    const palette = extractCmsContentPalette(DEFAULT_STYLE_CSS);
    expect(palette['--vbwd-border']).toBeUndefined();
  });

  it('is theme-aware — carries a dark theme border, not a hardcode', () => {
    const palette = extractCmsContentPalette(DARK_STYLE_CSS);
    expect(palette['--color-border']).toBe('#374151');
  });

  it('returns an empty palette for null / empty css', () => {
    expect(extractCmsContentPalette(null)).toEqual({});
    expect(extractCmsContentPalette('')).toEqual({});
  });
});

describe('CMS content wrapper theme-aware border (theme-switcher collision fix)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Simulate the theme-switcher `default` preset already applied to <html>:
    // an INLINE --color-border that (before the fix) shadows the CMS theme.
    // (Set-only, never removeProperty: happy-dom does not reliably re-persist a
    // custom property that was previously removed, so we keep the same value
    // across tests rather than clear/re-set it.)
    document.documentElement.style.setProperty('--color-border', '#dddddd');
  });

  it('re-asserts the CMS theme --color-border on the content wrapper so it wins over the <html> inline default', () => {
    const store = useCmsStore();
    store.currentStyleCss = DEFAULT_STYLE_CSS;

    const wrapper = mount(CmsLayoutRenderer, {
      props: { layout: LAYOUT, contentHtml: '<div class="vbwd-page"></div>', contentBlocks: {}, pageAssignments: [] },
    });

    const root = wrapper.find('.cms-layout').element as HTMLElement;
    expect(root.style.getPropertyValue('--color-border')).toBe('#e2e8f0');
  });

  it('leaves the <html>-level --color-border (Tarot / app chrome) untouched', () => {
    const store = useCmsStore();
    store.currentStyleCss = DEFAULT_STYLE_CSS;

    mount(CmsLayoutRenderer, {
      props: { layout: LAYOUT, contentHtml: '<div class="vbwd-page"></div>', contentBlocks: {}, pageAssignments: [] },
    });

    // The global token Tarot relies on must remain #dddddd — the fix scopes the
    // CMS palette to the content wrapper only, never to :root / <html>.
    expect(document.documentElement.style.getPropertyValue('--color-border')).toBe('#dddddd');
  });

  it('carries a dark CMS theme border onto the wrapper (theme-aware)', () => {
    const store = useCmsStore();
    store.currentStyleCss = DARK_STYLE_CSS;

    const wrapper = mount(CmsLayoutRenderer, {
      props: { layout: LAYOUT, contentHtml: '<div class="vbwd-page"></div>', contentBlocks: {}, pageAssignments: [] },
    });

    const root = wrapper.find('.cms-layout').element as HTMLElement;
    expect(root.style.getPropertyValue('--color-border')).toBe('#374151');
  });
});
