/**
 * useConsent — versioned, withdrawable consent state (S87).
 *
 * RED-first oracle: needsDecision is true when storage is empty or the stored
 * version is stale; acceptAll/rejectAll/save persist the right categories +
 * method; `necessary` is always true; granted() reflects the saved state;
 * re-opening then saving updates the record; the decision survives a hydrate
 * (reload). The module is a singleton, so each test re-imports it fresh.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CONSENT_STORAGE_KEY } from '../../src/consent/policy';
import type { UseConsent } from '../../src/consent/useConsent';

let useConsent: () => UseConsent;

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  ({ useConsent } = await import('../../src/consent/useConsent'));
});

function stored(): Record<string, unknown> | null {
  const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe('useConsent — needsDecision', () => {
  it('is true with empty storage', () => {
    expect(useConsent().needsDecision.value).toBe(true);
  });

  it('is false after a decision, then true again when the version is bumped', () => {
    const c = useConsent();
    c.acceptAll();
    expect(c.needsDecision.value).toBe(false);
    expect(c.isDecided.value).toBe(true);
    c.setConsentVersion(2);
    expect(c.needsDecision.value).toBe(true);
  });
});

describe('useConsent — decisions persist the right record', () => {
  it('acceptAll grants every category with method accept_all', () => {
    const c = useConsent();
    c.acceptAll();
    const record = stored()!;
    expect(record.method).toBe('accept_all');
    expect(record.categories).toEqual({
      necessary: true, preferences: true, statistics: true, marketing: true,
    });
    expect(typeof record.decidedAt).toBe('string');
    expect(c.granted('statistics')).toBe(true);
  });

  it('rejectAll keeps only necessary with method reject_all', () => {
    const c = useConsent();
    c.rejectAll();
    expect(stored()!.method).toBe('reject_all');
    expect(stored()!.categories).toEqual({
      necessary: true, preferences: false, statistics: false, marketing: false,
    });
    expect(c.granted('necessary')).toBe(true);
    expect(c.granted('marketing')).toBe(false);
  });

  it('save persists exactly the chosen optional categories, necessary forced on', () => {
    const c = useConsent();
    c.save({ statistics: true, marketing: false, preferences: true });
    expect(stored()!.method).toBe('custom');
    expect(stored()!.categories).toEqual({
      necessary: true, preferences: true, statistics: true, marketing: false,
    });
    expect(c.granted('statistics')).toBe(true);
    expect(c.granted('preferences')).toBe(true);
    expect(c.granted('marketing')).toBe(false);
  });
});

describe('useConsent — withdraw / re-open', () => {
  it('reopen shows the dialog again even after a decision; saving hides it', () => {
    const c = useConsent();
    c.acceptAll();
    expect(c.shouldShowDialog.value).toBe(false);
    c.reopen();
    expect(c.shouldShowDialog.value).toBe(true);
    c.rejectAll();
    expect(c.shouldShowDialog.value).toBe(false);
    expect(stored()!.method).toBe('reject_all');
  });
});

describe('useConsent — hydrate (reload)', () => {
  it('reflects a record written to storage before this composable read it', async () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
      version: 1, decidedAt: '2026-06-27T12:00:00Z', method: 'custom',
      categories: { necessary: true, preferences: false, statistics: true, marketing: false },
    }));
    const c = useConsent();
    c.hydrate();
    expect(c.isDecided.value).toBe(true);
    expect(c.granted('statistics')).toBe(true);
    expect(c.granted('marketing')).toBe(false);
  });

  it('treats malformed storage as no decision', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, '{not json');
    const c = useConsent();
    c.hydrate();
    expect(c.needsDecision.value).toBe(true);
  });
});
