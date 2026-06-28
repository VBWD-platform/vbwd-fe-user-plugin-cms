/**
 * `useConsent` — the single source of truth for the cookie-consent decision,
 * shared by the dialog, the persistent settings affordance, and the Consent
 * Mode bridge (DRY). Module-singleton reactive state, hydrated from localStorage
 * and written on every decision.
 *
 * This composable is the documented upgrade seam to a server-side consent record
 * (§8 of the sprint): swap `loadRecord`/`persist` for an API call without
 * touching the UI.
 */
import { reactive, computed, type ComputedRef } from 'vue';
import {
  CONSENT_STORAGE_KEY,
  OPTIONAL_CATEGORIES,
  deniedCategories,
  grantedCategories,
  type ConsentCategories,
  type ConsentCategory,
  type ConsentMethod,
  type ConsentRecord,
} from './policy';
import { emitConsentUpdate } from './consentMode';

interface ConsentState {
  record: ConsentRecord | null;
  configuredVersion: number;
  reopened: boolean;
}

function loadRecord(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (!parsed || typeof parsed.version !== 'number' || !parsed.categories) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

const state: ConsentState = reactive<ConsentState>({
  record: loadRecord(),
  configuredVersion: 1,
  reopened: false,
});

function makeRecord(
  method: ConsentMethod,
  categories: ConsentCategories,
): ConsentRecord {
  return {
    version: state.configuredVersion,
    decidedAt: new Date().toISOString(),
    method,
    // `necessary` can never be written off — strictly-necessary is exempt.
    categories: { ...categories, necessary: true },
  };
}

function persist(record: ConsentRecord): void {
  state.record = record;
  state.reopened = false;
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* storage unavailable — in-memory state still drives this session */
  }
  emitConsentUpdate(record.categories);
}

export interface UseConsent {
  needsDecision: ComputedRef<boolean>;
  isDecided: ComputedRef<boolean>;
  shouldShowDialog: ComputedRef<boolean>;
  categories: ComputedRef<ConsentCategories>;
  record: ComputedRef<ConsentRecord | null>;
  granted(category: ConsentCategory): boolean;
  acceptAll(): void;
  rejectAll(): void;
  save(selected: Partial<ConsentCategories>): void;
  reopen(): void;
  setConsentVersion(version: number): void;
  hydrate(): void;
}

export function useConsent(): UseConsent {
  const needsDecision = computed(
    () => !state.record || state.record.version < state.configuredVersion,
  );
  const isDecided = computed(() => !needsDecision.value);
  const shouldShowDialog = computed(() => needsDecision.value || state.reopened);
  const categories = computed<ConsentCategories>(
    () => state.record?.categories ?? deniedCategories(),
  );
  const record = computed(() => state.record);

  function granted(category: ConsentCategory): boolean {
    if (category === 'necessary') return true;
    return state.record?.categories?.[category] === true;
  }

  function acceptAll(): void {
    persist(makeRecord('accept_all', grantedCategories()));
  }

  function rejectAll(): void {
    persist(makeRecord('reject_all', deniedCategories()));
  }

  function save(selected: Partial<ConsentCategories>): void {
    const next = deniedCategories();
    for (const category of OPTIONAL_CATEGORIES) {
      next[category] = selected[category] === true;
    }
    persist(makeRecord('custom', next));
  }

  function reopen(): void {
    state.reopened = true;
  }

  function setConsentVersion(version: number): void {
    if (typeof version === 'number' && version > 0) {
      state.configuredVersion = version;
    }
  }

  function hydrate(): void {
    state.record = loadRecord();
  }

  return {
    needsDecision,
    isDecided,
    shouldShowDialog,
    categories,
    record,
    granted,
    acceptAll,
    rejectAll,
    save,
    reopen,
    setConsentVersion,
    hydrate,
  };
}
