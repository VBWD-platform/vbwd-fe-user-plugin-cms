<template>
  <Teleport to="body">
    <!-- Consent dialog: shown only when a decision is required or re-opened. -->
    <div
      v-if="shouldShowDialog"
      ref="dialogEl"
      class="cookie-consent__backdrop"
      :class="{ 'cookie-consent__backdrop--banner': mode === 'banner' }"
    >
      <div
        class="cookie-consent"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        data-testid="cookie-consent"
        @keydown="onKeydown"
      >
        <!-- ── Layer 1 ── -->
        <template v-if="!showCustomize">
          <h2
            :id="titleId"
            class="cookie-consent__title"
          >
            {{ t('cms.cookieConsent.title') }}
          </h2>
          <p class="cookie-consent__summary">
            {{ t('cms.cookieConsent.summary') }}
            <a
              :href="privacyPolicyUrl"
              class="cookie-consent__policy-link"
              data-testid="cookie-policy-link"
            >{{ t('cms.cookieConsent.privacyLink') }}</a>
          </p>
          <div class="cookie-consent__actions">
            <button
              ref="firstFocusable"
              type="button"
              class="cookie-consent__btn"
              data-testid="cookie-accept-all"
              @click="onAcceptAll"
            >
              {{ t('cms.cookieConsent.acceptAll') }}
            </button>
            <button
              type="button"
              class="cookie-consent__btn"
              data-testid="cookie-reject-all"
              @click="onRejectAll"
            >
              {{ t('cms.cookieConsent.rejectAll') }}
            </button>
            <button
              type="button"
              class="cookie-consent__btn"
              data-testid="cookie-customize"
              @click="openCustomize"
            >
              {{ t('cms.cookieConsent.customize') }}
            </button>
          </div>
        </template>

        <!-- ── Layer 2 (Customize) ── -->
        <template v-else>
          <h2
            :id="titleId"
            class="cookie-consent__title"
          >
            {{ t('cms.cookieConsent.customizeTitle') }}
          </h2>
          <ul class="cookie-consent__categories">
            <li
              v-for="category in editableCategories"
              :key="category"
              class="cookie-consent__category"
            >
              <label class="cookie-consent__category-label">
                <input
                  type="checkbox"
                  class="cookie-consent__toggle"
                  :checked="category === 'necessary' ? true : selection[category]"
                  :disabled="category === 'necessary'"
                  :data-testid="`cookie-toggle-${category}`"
                  @change="onToggle(category, $event)"
                >
                <span class="cookie-consent__category-name">
                  {{ t(`cms.cookieConsent.categories.${category}.name`) }}
                </span>
              </label>
              <p class="cookie-consent__category-purpose">
                {{ t(`cms.cookieConsent.categories.${category}.purpose`) }}
              </p>
            </li>
          </ul>
          <div class="cookie-consent__actions">
            <button
              type="button"
              class="cookie-consent__btn"
              data-testid="cookie-save"
              @click="onSave"
            >
              {{ t('cms.cookieConsent.save') }}
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Persistent re-open affordance, shown once a decision exists. -->
    <button
      v-if="showSettingsButton && isDecided && !shouldShowDialog"
      type="button"
      class="cookie-consent__settings"
      data-testid="cookie-settings"
      :aria-label="t('cms.cookieConsent.settings')"
      @click="onReopen"
    >
      {{ t('cms.cookieConsent.settings') }}
    </button>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useConsent } from '../consent/useConsent';
import { emitConsentDefault, emitConsentUpdate } from '../consent/consentMode';
import {
  OPEN_CONSENT_EVENT,
  OPTIONAL_CATEGORIES,
  type ConsentCategory,
} from '../consent/policy';

const props = defineProps<{
  config?: Record<string, unknown>;
}>();

const { t } = useI18n();
const {
  shouldShowDialog,
  isDecided,
  categories,
  acceptAll,
  rejectAll,
  save,
  reopen,
  setConsentVersion,
  hydrate,
} = useConsent();

// ── Derived config ─────────────────────────────────────────────────────────

const consentVersion = computed(
  () => (props.config?.consent_version as number | undefined) ?? 1,
);
const privacyPolicyUrl = computed(
  () => (props.config?.privacy_policy_url as string | undefined) || '/privacy',
);
const mode = computed(
  () => (props.config?.mode as string | undefined) || 'modal',
);
const showSettingsButton = computed(
  () => props.config?.show_settings_button !== false,
);

// Optional categories the admin enabled (necessary is always implicit/locked).
const editableCategories = computed<ConsentCategory[]>(() => {
  const configured = Array.isArray(props.config?.categories)
    ? (props.config?.categories as string[])
    : ['necessary', ...OPTIONAL_CATEGORIES];
  const optional = OPTIONAL_CATEGORIES.filter((c) => configured.includes(c));
  return ['necessary', ...optional];
});

// ── Layer / selection state ──────────────────────────────────────────────────

const titleId = 'cookie-consent-title';
const showCustomize = ref(false);
const selection = reactive<Record<ConsentCategory, boolean>>({
  necessary: true,
  preferences: false,
  statistics: false,
  marketing: false,
});

function openCustomize(): void {
  // Seed toggles from the current decision (or all-denied default).
  for (const category of OPTIONAL_CATEGORIES) {
    selection[category] = categories.value[category] === true;
  }
  showCustomize.value = true;
}

function onToggle(category: ConsentCategory, event: Event): void {
  if (category === 'necessary') return;
  selection[category] = (event.target as HTMLInputElement).checked;
}

function onAcceptAll(): void {
  acceptAll();
  showCustomize.value = false;
}

function onRejectAll(): void {
  rejectAll();
  showCustomize.value = false;
}

function onSave(): void {
  save({
    preferences: selection.preferences,
    statistics: selection.statistics,
    marketing: selection.marketing,
  });
  showCustomize.value = false;
}

function onReopen(): void {
  reopen();
  showCustomize.value = false;
}

// ── Focus management (modern, accessible) ────────────────────────────────────

const dialogEl = ref<HTMLElement | null>(null);
const firstFocusable = ref<HTMLButtonElement | null>(null);

function focusableEls(): HTMLElement[] {
  if (!dialogEl.value) return [];
  return Array.from(
    dialogEl.value.querySelectorAll<HTMLElement>(
      'button, a[href], input:not([disabled])',
    ),
  );
}

// ESC must NOT silently dismiss (a decision is required); Tab is trapped.
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    return;
  }
  if (event.key !== 'Tab') return;
  const els = focusableEls();
  if (!els.length) return;
  const first = els[0];
  const last = els[els.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

// ── CSS override (admin "CSS" tab → config.css), mirrors ContactForm ─────────

let styleEl: HTMLStyleElement | null = null;
function injectCss(): void {
  const css = props.config?.css as string | undefined;
  if (css) {
    styleEl = document.createElement('style');
    styleEl.setAttribute('data-cookie-consent-css', '');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

function onOpenRequest(): void {
  onReopen();
}

onMounted(async () => {
  setConsentVersion(consentVersion.value);
  hydrate();
  // Emit the all-denied Consent Mode default as early as possible; re-emit the
  // stored decision on a returning visit so trackers reflect prior consent.
  emitConsentDefault();
  if (isDecided.value) {
    // Re-apply the stored decision via the bridge without a fresh write.
    emitConsentUpdate(categories.value);
  }
  injectCss();
  window.addEventListener(OPEN_CONSENT_EVENT, onOpenRequest);
  await nextTick();
  firstFocusable.value?.focus();
});

onUnmounted(() => {
  window.removeEventListener(OPEN_CONSENT_EVENT, onOpenRequest);
  if (styleEl) {
    styleEl.remove();
    styleEl = null;
  }
});
</script>

<style scoped>
/* All visuals reuse the fe-core design tokens (var(--vbwd-*)) — theme-aware,
   mobile-first, no bespoke colours. The admin "CSS" tab (config.css) can layer
   further overrides on top via the injected <style data-cookie-consent-css>. */

.cookie-consent__backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.55);
}

.cookie-consent__backdrop--banner {
  align-items: flex-end;
  background: transparent;
  pointer-events: none;
}

.cookie-consent {
  pointer-events: auto;
  width: min(560px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  padding: 1.75rem;
  border-radius: 12px;
  background: var(--vbwd-card-bg, #fff);
  color: var(--vbwd-text-body, #333);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  font-family: var(--vbwd-font-body, inherit);
}

.cookie-consent__title {
  margin: 0 0 0.75rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--vbwd-text-heading, #2c3e50);
}

.cookie-consent__summary {
  margin: 0 0 1.25rem;
  font-size: 0.95rem;
  line-height: 1.5;
}

.cookie-consent__policy-link {
  color: var(--vbwd-color-primary, #3498db);
  text-decoration: underline;
}

.cookie-consent__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

/* Equal-prominence buttons — same variant/size for every layer-1 action
   (Accept / Reject / Customize). No dark-pattern nudging (DSGVO). */
.cookie-consent__btn {
  flex: 1 1 auto;
  min-width: 120px;
  padding: 0.7rem 1.25rem;
  border: 1px solid var(--vbwd-color-primary, #3498db);
  border-radius: 6px;
  background: var(--vbwd-color-primary, #3498db);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s, opacity 0.15s;
}

.cookie-consent__btn:hover {
  background: var(--vbwd-color-primary-hover, #2980b9);
}

.cookie-consent__btn:focus-visible {
  outline: 3px solid var(--vbwd-color-primary, #3498db);
  outline-offset: 2px;
}

.cookie-consent__categories {
  list-style: none;
  margin: 0 0 1.25rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cookie-consent__category-label {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 600;
  cursor: pointer;
}

.cookie-consent__category-purpose {
  margin: 0.35rem 0 0 1.7rem;
  font-size: 0.85rem;
  opacity: 0.75;
}

.cookie-consent__settings {
  position: fixed;
  left: 1rem;
  bottom: 1rem;
  z-index: 9000;
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--vbwd-border-color, #d1d5db);
  border-radius: 999px;
  background: var(--vbwd-card-bg, #fff);
  color: var(--vbwd-text-body, #333);
  font-size: 0.8rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

@media (prefers-reduced-motion: reduce) {
  .cookie-consent__btn {
    transition: none;
  }
}
</style>
