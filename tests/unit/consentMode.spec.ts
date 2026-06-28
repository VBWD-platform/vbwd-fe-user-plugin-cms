/**
 * Consent Mode v2 bridge — the modern script-gating seam (S87).
 *
 * RED-first oracle: the default is all-denied (security granted) and is queued
 * to `dataLayer` even with no `gtag` present; an update maps our four buckets
 * onto the correct Consent Mode signals and broadcasts `vbwd:consent-changed`.
 *
 * Engineering requirements (binding): TDD-first, SOLID/SRP (signalling only —
 * no SDK), DRY, no overengineering (Consent Mode over a full CMP stack).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { emitConsentDefault, emitConsentUpdate } from '../../src/consent/consentMode';
import { deniedCategories, grantedCategories } from '../../src/consent/policy';

interface GtagWin {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}

function lastEntry(layer: unknown[] | undefined): unknown {
  return layer ? layer[layer.length - 1] : undefined;
}

beforeEach(() => {
  const win = window as unknown as GtagWin;
  delete win.gtag;
  win.dataLayer = [];
});

describe('consentMode.emitConsentDefault', () => {
  it('queues an all-denied default (security granted) to dataLayer when gtag is absent', () => {
    emitConsentDefault();
    const win = window as unknown as GtagWin;
    const last = lastEntry(win.dataLayer) as unknown[];
    expect(last[0]).toBe('consent');
    expect(last[1]).toBe('default');
    expect(last[2]).toEqual({
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      functionality_storage: 'denied',
      personalization_storage: 'denied',
      security_storage: 'granted',
    });
  });

  it('calls gtag directly when a real gtag is present', () => {
    const gtag = vi.fn();
    (window as unknown as GtagWin).gtag = gtag;
    emitConsentDefault();
    expect(gtag).toHaveBeenCalledWith('consent', 'default', expect.objectContaining({
      analytics_storage: 'denied',
      security_storage: 'granted',
    }));
  });
});

describe('consentMode.emitConsentUpdate', () => {
  it('maps statistics→analytics, marketing→ad_*, preferences→functionality/personalization', () => {
    emitConsentUpdate({ necessary: true, preferences: true, statistics: true, marketing: false });
    const win = window as unknown as GtagWin;
    const last = lastEntry(win.dataLayer) as unknown[];
    expect(last[1]).toBe('update');
    expect(last[2]).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
      personalization_storage: 'granted',
      security_storage: 'granted',
    });
  });

  it('grants every ad/analytics signal when all categories are granted', () => {
    emitConsentUpdate(grantedCategories());
    const win = window as unknown as GtagWin;
    const signals = (lastEntry(win.dataLayer) as unknown[])[2] as Record<string, string>;
    expect(Object.values(signals).every((v) => v === 'granted')).toBe(true);
  });

  it('denies every optional signal when only necessary is granted', () => {
    emitConsentUpdate(deniedCategories());
    const win = window as unknown as GtagWin;
    const signals = (lastEntry(win.dataLayer) as unknown[])[2] as Record<string, string>;
    expect(signals.analytics_storage).toBe('denied');
    expect(signals.ad_storage).toBe('denied');
    expect(signals.security_storage).toBe('granted');
  });

  it('dispatches a vbwd:consent-changed window event with the categories', () => {
    const handler = vi.fn();
    window.addEventListener('vbwd:consent-changed', handler);
    const categories = { necessary: true, preferences: false, statistics: true, marketing: false };
    emitConsentUpdate(categories);
    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail.categories).toEqual(categories);
    window.removeEventListener('vbwd:consent-changed', handler);
  });
});
