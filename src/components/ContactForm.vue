<template>
  <div class="contact-form-widget">
    <!-- Inject analytics/tracking HTML (e.g. GA event snippets) -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div
      v-if="analyticsHtml"
      class="contact-form-widget__analytics"
      v-html="analyticsHtml"
    />

    <!-- Not configured -->
    <div
      v-if="!recipientEmail"
      class="contact-form-widget__error"
      data-testid="cf-not-configured"
    >
      <p>{{ $t('contactForm.notConfigured') }}</p>
    </div>

    <!-- Success state -->
    <div
      v-else-if="submitted"
      class="contact-form-widget__success"
      data-testid="cf-success"
    >
      <p>{{ successMessage }}</p>
    </div>

    <!-- Form -->
    <form
      v-else
      class="contact-form-widget__form"
      data-testid="cf-form"
      novalidate
      @submit.prevent="handleSubmit"
    >
      <!-- Honeypot — always present, must stay empty -->
      <div
        class="contact-form-widget__hp"
        aria-hidden="true"
        style="display:none !important; position:absolute; left:-9999px;"
      >
        <label for="_cf_hp">Leave blank</label>
        <input
          id="_cf_hp"
          v-model="honeypot"
          type="text"
          name="_hp"
          tabindex="-1"
          autocomplete="off"
        >
      </div>

      <!-- Dynamic fields -->
      <div
        v-for="field in fields"
        :key="field.id"
        class="contact-form-widget__field"
      >
        <label
          :for="`cf_${field.id}`"
          class="contact-form-widget__label"
        >
          {{ field.label }}
          <span
            v-if="field.required"
            class="contact-form-widget__required"
            aria-hidden="true"
          >*</span>
        </label>

        <!-- Textarea -->
        <textarea
          v-if="field.type === 'textarea'"
          :id="`cf_${field.id}`"
          v-model="formValues[field.id]"
          class="contact-form-widget__input contact-form-widget__textarea"
          :name="field.id"
          :required="field.required"
          :aria-required="field.required"
          rows="4"
          :data-testid="`cf-field-${field.id}`"
        />

        <!-- Radio group -->
        <div
          v-else-if="field.type === 'radio'"
          class="contact-form-widget__radio-group"
          :data-testid="`cf-field-${field.id}`"
        >
          <label
            v-for="opt in field.options"
            :key="opt"
            class="contact-form-widget__option"
          >
            <input
              v-model="formValues[field.id]"
              type="radio"
              :name="field.id"
              :value="opt"
              :required="field.required"
            >
            {{ opt }}
          </label>
        </div>

        <!-- Checkbox group -->
        <div
          v-else-if="field.type === 'checkbox'"
          class="contact-form-widget__checkbox-group"
          :data-testid="`cf-field-${field.id}`"
        >
          <label
            v-for="opt in field.options"
            :key="opt"
            class="contact-form-widget__option"
          >
            <input
              type="checkbox"
              :name="field.id"
              :value="opt"
              :checked="Array.isArray(formValues[field.id]) && formValues[field.id].includes(opt)"
              @change="toggleCheckbox(field.id, opt, $event)"
            >
            {{ opt }}
          </label>
        </div>

        <!-- All other input types (text, email, tel, url) -->
        <input
          v-else
          :id="`cf_${field.id}`"
          v-model="formValues[field.id]"
          class="contact-form-widget__input"
          :type="field.type"
          :name="field.id"
          :required="field.required"
          :aria-required="field.required"
          :data-testid="`cf-field-${field.id}`"
        >

        <!-- Per-field validation error -->
        <p
          v-if="fieldErrors[field.id]"
          class="contact-form-widget__field-error"
          role="alert"
          :data-testid="`cf-error-${field.id}`"
        >
          {{ fieldErrors[field.id] }}
        </p>
      </div>

      <!-- CAPTCHA / reCAPTCHA embed -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div
        v-if="captchaHtml"
        class="contact-form-widget__captcha"
        v-html="captchaHtml"
      />

      <!-- Global error -->
      <p
        v-if="globalError"
        class="contact-form-widget__error-msg"
        role="alert"
        data-testid="cf-global-error"
      >
        {{ globalError }}
      </p>

      <button
        type="submit"
        class="contact-form-widget__submit"
        :disabled="submitting"
        data-testid="cf-submit"
      >
        {{ submitting ? $t('common.loading') : $t('contactForm.submit') }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

export interface ContactField {
  id: string;
  type: 'text' | 'email' | 'tel' | 'url' | 'textarea' | 'radio' | 'checkbox';
  label: string;
  required?: boolean;
  options?: string[];
}

const props = defineProps<{
  config?: Record<string, unknown>;
}>();

const { t } = useI18n();

// ── Derived config ─────────────────────────────────────────────────────────

const recipientEmail = computed(
  () => (props.config?.recipient_email as string | undefined) ?? ''
);

const successMessage = computed(
  () => (props.config?.success_message as string | undefined) || t('contactForm.defaultSuccess')
);

const fields = computed<ContactField[]>(() => {
  const raw = props.config?.fields;
  return Array.isArray(raw) ? (raw as ContactField[]) : [];
});

const captchaHtml = computed(
  () => (props.config?.captcha_html as string | undefined) ?? ''
);

const analyticsHtml = computed(
  () => (props.config?.analytics_html as string | undefined) ?? ''
);

// ── State ──────────────────────────────────────────────────────────────────

const honeypot = ref('');
const formValues = ref<Record<string, string | string[]>>({});
const fieldErrors = ref<Record<string, string>>({});
const globalError = ref('');
const submitting = ref(false);
const submitted = ref(false);

// ── CSS injection ──────────────────────────────────────────────────────────

let styleEl: HTMLStyleElement | null = null;
onMounted(() => {
  const css = props.config?.css as string | undefined;
  if (css) {
    styleEl = document.createElement('style');
    styleEl.setAttribute('data-contact-form-css', '');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }
  // Initialise checkbox arrays
  fields.value.forEach((f) => {
    if (f.type === 'checkbox') formValues.value[f.id] = [];
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────

function toggleCheckbox(fieldId: string, opt: string, event: Event) {
  const current = (formValues.value[fieldId] as string[]) ?? [];
  const checked = (event.target as HTMLInputElement).checked;
  if (checked) {
    formValues.value[fieldId] = [...current, opt];
  } else {
    formValues.value[fieldId] = current.filter((v) => v !== opt);
  }
}

function validateForm(): boolean {
  fieldErrors.value = {};
  for (const field of fields.value) {
    if (!field.required) continue;
    const val = formValues.value[field.id];
    const empty = Array.isArray(val) ? val.length === 0 : !String(val ?? '').trim();
    if (empty) {
      fieldErrors.value[field.id] = t('contactForm.fieldRequired', { label: field.label });
    }
  }
  return Object.keys(fieldErrors.value).length === 0;
}

// ── Submit ─────────────────────────────────────────────────────────────────

async function handleSubmit() {
  globalError.value = '';
  if (!validateForm()) return;

  submitting.value = true;
  try {
    const response = await fetch('/api/v1/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        widget_slug: props.config?.widget_slug ?? '',
        _hp: honeypot.value,
        fields: { ...formValues.value },
      }),
    });

    if (response.status === 429) {
      globalError.value = t('contactForm.rateLimited');
      return;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      globalError.value = (body as any).error || t('common.errors.generic');
      return;
    }

    submitted.value = true;
  } catch {
    globalError.value = t('common.errors.generic');
  } finally {
    submitting.value = false;
  }
}
</script>

<style>
/* Non-scoped so CMS page injected CSS can override these rules. */

.contact-form-widget {
  max-width: 680px;
  margin: 0 auto;
  padding: 32px 24px;
  font-family: var(--vbwd-font-body, inherit);
}

.contact-form-widget__hp {
  display: none !important;
  position: absolute;
  left: -9999px;
}

.contact-form-widget__form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.contact-form-widget__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.contact-form-widget__label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--vbwd-text-heading, #2c3e50);
}

.contact-form-widget__required {
  color: var(--vbwd-color-error, #e74c3c);
  margin-left: 2px;
}

.contact-form-widget__input {
  padding: 10px 14px;
  border: 1px solid var(--vbwd-border-color, #d1d5db);
  border-radius: 6px;
  font-size: 0.95rem;
  color: var(--vbwd-text-body, #333);
  background: var(--vbwd-card-bg, #fff);
  transition: border-color 0.15s;
  outline: none;
}

.contact-form-widget__input:focus {
  border-color: var(--vbwd-color-primary, #3498db);
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.15);
}

.contact-form-widget__textarea {
  resize: vertical;
  min-height: 110px;
}

.contact-form-widget__radio-group,
.contact-form-widget__checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.contact-form-widget__option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--vbwd-text-body, #333);
  cursor: pointer;
}

.contact-form-widget__field-error {
  font-size: 0.82rem;
  color: var(--vbwd-color-error, #e74c3c);
  margin: 0;
}

.contact-form-widget__error-msg {
  font-size: 0.9rem;
  color: var(--vbwd-color-error, #e74c3c);
  margin: 0;
}

.contact-form-widget__submit {
  align-self: flex-start;
  padding: 12px 28px;
  background: var(--vbwd-color-primary, #3498db);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s, opacity 0.2s;
}

.contact-form-widget__submit:hover:not(:disabled) {
  background: var(--vbwd-color-primary-hover, #2980b9);
}

.contact-form-widget__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.contact-form-widget__success {
  text-align: center;
  padding: 48px 24px;
  color: var(--vbwd-color-success, #27ae60);
  font-size: 1.1rem;
  font-weight: 500;
}

.contact-form-widget__error {
  text-align: center;
  padding: 40px 24px;
  color: var(--vbwd-text-muted, #666);
  font-size: 0.9rem;
}
</style>
