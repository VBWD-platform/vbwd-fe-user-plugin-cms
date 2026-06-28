/**
 * Cookie-consent policy primitives — the storage key, the category vocabulary,
 * and the typed record shape persisted in localStorage.
 *
 * Kept dependency-free (no Vue, no DOM) so it can be imported by the composable,
 * the Consent Mode bridge, and the tests without pulling a runtime.
 */

/** localStorage key holding the visitor's consent record. */
export const CONSENT_STORAGE_KEY = 'vbwd_cookie_consent';

/** Window event a CMS footer/menu link dispatches to re-open the dialog. */
export const OPEN_CONSENT_EVENT = 'vbwd:open-cookie-consent';

/** Window event the bridge dispatches whenever the granted set changes. */
export const CONSENT_CHANGED_EVENT = 'vbwd:consent-changed';

export type ConsentCategory =
  | 'necessary'
  | 'preferences'
  | 'statistics'
  | 'marketing';

/** Every category except the always-on `necessary` bucket. */
export const OPTIONAL_CATEGORIES: ConsentCategory[] = [
  'preferences',
  'statistics',
  'marketing',
];

export type ConsentMethod = 'accept_all' | 'reject_all' | 'custom';

export interface ConsentCategories {
  necessary: boolean;
  preferences: boolean;
  statistics: boolean;
  marketing: boolean;
}

export interface ConsentRecord {
  version: number;
  decidedAt: string;
  method: ConsentMethod;
  categories: ConsentCategories;
}

/** Strictly-necessary only — everything optional denied. */
export function deniedCategories(): ConsentCategories {
  return {
    necessary: true,
    preferences: false,
    statistics: false,
    marketing: false,
  };
}

/** Every category granted. */
export function grantedCategories(): ConsentCategories {
  return {
    necessary: true,
    preferences: true,
    statistics: true,
    marketing: true,
  };
}
