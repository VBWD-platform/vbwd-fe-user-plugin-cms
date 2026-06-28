/**
 * CookieConsent.vue — the GDPR/DSGVO consent widget (S87).
 *
 * RED-first oracle: the dialog renders (via Teleport to body) only when a
 * decision is required; layer 1 shows three equal-prominence buttons; Customize
 * reveals per-category toggles with `necessary` locked on; Accept/Reject/Save
 * persist and close; the persistent "Cookie settings" affordance re-opens the
 * dialog; a `vbwd:open-cookie-consent` window event also re-opens it. Assertions
 * key off data-testid, so i18n returns keys (missing: key => key).
 *
 * Engineering requirements (binding): TDD-first, SOLID (UI only — state in
 * useConsent, signalling in consentMode), DRY, no bespoke CSS (fe-core tokens),
 * accessible (labelled dialog, equal-prominence non-dark-pattern buttons).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { nextTick } from 'vue';
import { CONSENT_STORAGE_KEY } from '../../src/consent/policy';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  missing: (_locale, key) => key,
  messages: { en: {} },
});

const CONFIG = {
  consent_version: 1,
  privacy_policy_url: '/datenschutz',
  mode: 'modal',
  categories: ['necessary', 'statistics', 'marketing', 'preferences'],
  show_settings_button: true,
};

let CookieConsent: unknown;
let wrapper: VueWrapper | null = null;

beforeEach(async () => {
  localStorage.clear();
  document.body.innerHTML = '';
  vi.resetModules();
  ({ default: CookieConsent } = await import('../../src/components/CookieConsent.vue'));
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = '';
});

async function mountWidget(config: Record<string, unknown> = CONFIG) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wrapper = mount(CookieConsent as any, {
    props: { config },
    global: { plugins: [i18n] },
  });
  await flushPromises();
  await nextTick();
}

const byId = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`);

async function click(id: string) {
  byId(id)!.click();
  await flushPromises();
  await nextTick();
}

function stored(): Record<string, unknown> | null {
  const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe('CookieConsent — layer 1', () => {
  it('renders the dialog via Teleport to body when a decision is required', async () => {
    await mountWidget();
    expect(byId('cookie-consent')).not.toBeNull();
    // Teleported: it is NOT inside the component root.
    expect(wrapper!.find('[data-testid="cookie-consent"]').exists()).toBe(false);
  });

  it('shows Accept / Reject / Customize with equal prominence (same class + element)', async () => {
    await mountWidget();
    const accept = byId('cookie-accept-all')!;
    const reject = byId('cookie-reject-all')!;
    const customize = byId('cookie-customize')!;
    expect(accept).not.toBeNull();
    expect(reject).not.toBeNull();
    expect(customize).not.toBeNull();
    expect(accept.className).toBe(reject.className);
    expect(reject.className).toBe(customize.className);
    expect(accept.tagName).toBe('BUTTON');
  });

  it('renders the privacy-policy link from config', async () => {
    await mountWidget();
    expect(byId('cookie-policy-link')!.getAttribute('href')).toBe('/datenschutz');
  });

  it('does NOT render the dialog once a decision exists', async () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
      version: 1, decidedAt: '2026-06-27T00:00:00Z', method: 'accept_all',
      categories: { necessary: true, preferences: true, statistics: true, marketing: true },
    }));
    await mountWidget();
    expect(byId('cookie-consent')).toBeNull();
  });
});

describe('CookieConsent — decisions', () => {
  it('Accept all grants every category and closes the dialog', async () => {
    await mountWidget();
    await click('cookie-accept-all');
    expect(stored()!.method).toBe('accept_all');
    expect((stored()!.categories as Record<string, boolean>).marketing).toBe(true);
    expect(byId('cookie-consent')).toBeNull();
  });

  it('Reject all keeps only necessary and reveals the settings affordance', async () => {
    await mountWidget();
    await click('cookie-reject-all');
    expect(stored()!.method).toBe('reject_all');
    expect((stored()!.categories as Record<string, boolean>).statistics).toBe(false);
    expect(byId('cookie-consent')).toBeNull();
    expect(byId('cookie-settings')).not.toBeNull();
  });
});

describe('CookieConsent — layer 2 (customize)', () => {
  it('reveals per-category toggles with necessary locked on', async () => {
    await mountWidget();
    await click('cookie-customize');
    const necessary = byId('cookie-toggle-necessary') as HTMLInputElement;
    expect(necessary).not.toBeNull();
    expect(necessary.disabled).toBe(true);
    expect(necessary.checked).toBe(true);
    expect(byId('cookie-toggle-statistics')).not.toBeNull();
    expect(byId('cookie-toggle-marketing')).not.toBeNull();
  });

  it('Save persists exactly the toggled optional categories', async () => {
    await mountWidget();
    await click('cookie-customize');
    const stats = byId('cookie-toggle-statistics') as HTMLInputElement;
    stats.checked = true;
    stats.dispatchEvent(new Event('change'));
    await nextTick();
    await click('cookie-save');
    expect(stored()!.method).toBe('custom');
    const categories = stored()!.categories as Record<string, boolean>;
    expect(categories.statistics).toBe(true);
    expect(categories.marketing).toBe(false);
  });
});

describe('CookieConsent — configurable presentation', () => {
  it('centres the popup by default (no --bottom modifier)', async () => {
    await mountWidget();
    const backdrop = byId('cookie-consent-backdrop')!;
    expect(backdrop.className).not.toContain('cookie-consent__backdrop--bottom');
  });

  it('anchors to the bottom area when position = bottom', async () => {
    await mountWidget({ ...CONFIG, position: 'bottom' });
    expect(byId('cookie-consent-backdrop')!.className).toContain('cookie-consent__backdrop--bottom');
  });

  it('falls back to bottom for a legacy mode = banner record', async () => {
    await mountWidget({ ...CONFIG, position: undefined, mode: 'banner' });
    expect(byId('cookie-consent-backdrop')!.className).toContain('cookie-consent__backdrop--bottom');
  });

  it('renders the additional text when configured', async () => {
    await mountWidget({ ...CONFIG, additional_text: 'This site serves the EU.' });
    const extra = byId('cookie-additional-text');
    expect(extra).not.toBeNull();
    expect(extra!.textContent).toContain('This site serves the EU.');
  });

  it('omits the additional text element when empty', async () => {
    await mountWidget({ ...CONFIG, additional_text: '' });
    expect(byId('cookie-additional-text')).toBeNull();
  });

  it('applies the backdrop blend opacity from config', async () => {
    await mountWidget({ ...CONFIG, backdrop_opacity: 0.2 });
    expect(byId('cookie-consent-backdrop')!.style.background).toBe('rgba(0, 0, 0, 0.2)');
  });

  it('clamps an out-of-range backdrop opacity', async () => {
    await mountWidget({ ...CONFIG, backdrop_opacity: 5 });
    expect(byId('cookie-consent-backdrop')!.style.background).toBe('rgba(0, 0, 0, 1)');
  });
});

describe('CookieConsent — withdraw / re-open', () => {
  it('the settings button re-opens the dialog after a decision', async () => {
    await mountWidget();
    await click('cookie-reject-all');
    expect(byId('cookie-consent')).toBeNull();
    await click('cookie-settings');
    expect(byId('cookie-consent')).not.toBeNull();
  });

  it('re-opens on a vbwd:open-cookie-consent window event', async () => {
    await mountWidget();
    await click('cookie-accept-all');
    expect(byId('cookie-consent')).toBeNull();
    window.dispatchEvent(new CustomEvent('vbwd:open-cookie-consent'));
    await nextTick();
    expect(byId('cookie-consent')).not.toBeNull();
  });
});
