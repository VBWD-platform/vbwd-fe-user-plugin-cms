/**
 * Google Consent Mode v2 bridge — the modern, decoupled way to make trackers
 * respect consent (replaces the old "reject ⇒ block route" guard).
 *
 * It only *signals*: it never bundles or loads an analytics SDK. A later-loading
 * Google tag reads `window.dataLayer`, so emitting the all-denied default early
 * — even before `gtag` exists — guarantees no non-essential storage fires before
 * the visitor decides. Non-gtag consumers can instead listen for
 * `vbwd:consent-changed` or read `useConsent().granted(cat)`.
 */
import {
  CONSENT_CHANGED_EVENT,
  type ConsentCategories,
} from './policy';

type ConsentValue = 'granted' | 'denied';

export interface ConsentSignals {
  ad_storage: ConsentValue;
  ad_user_data: ConsentValue;
  ad_personalization: ConsentValue;
  analytics_storage: ConsentValue;
  functionality_storage: ConsentValue;
  personalization_storage: ConsentValue;
  security_storage: ConsentValue;
}

interface GtagWindow {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}

/**
 * Push a `consent` command. If a real `gtag` is already present we call it;
 * otherwise we queue the command on `dataLayer` so a later Google tag still
 * sees it (the canonical gtag shim reads the same array).
 */
function pushConsent(command: 'default' | 'update', signals: ConsentSignals): void {
  const win = window as unknown as GtagWindow;
  win.dataLayer = win.dataLayer || [];
  if (typeof win.gtag === 'function') {
    win.gtag('consent', command, signals);
  } else {
    win.dataLayer.push(['consent', command, signals]);
  }
}

const grant = (on: boolean): ConsentValue => (on ? 'granted' : 'denied');

/**
 * Emit the all-denied default (security always granted). Idempotent and safe to
 * call as early as the widget mounts, with or without `gtag` present.
 */
export function emitConsentDefault(): void {
  pushConsent('default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'denied',
    personalization_storage: 'denied',
    security_storage: 'granted',
  });
}

/**
 * Map our four buckets onto Consent Mode v2 signals and emit an `update`, then
 * broadcast `vbwd:consent-changed` for non-gtag consumers.
 *
 *   statistics  → analytics_storage
 *   marketing   → ad_storage / ad_user_data / ad_personalization
 *   preferences → functionality_storage / personalization_storage
 */
export function emitConsentUpdate(categories: ConsentCategories): void {
  pushConsent('update', {
    analytics_storage: grant(categories.statistics),
    ad_storage: grant(categories.marketing),
    ad_user_data: grant(categories.marketing),
    ad_personalization: grant(categories.marketing),
    functionality_storage: grant(categories.preferences),
    personalization_storage: grant(categories.preferences),
    security_storage: 'granted',
  });
  window.dispatchEvent(
    new CustomEvent(CONSENT_CHANGED_EVENT, { detail: { categories } }),
  );
}
