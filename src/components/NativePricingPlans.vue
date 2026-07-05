<template>
  <Landing1View
    :category="category"
    :plan-slugs="planSlugs"
    :heading="heading"
    :subtitle="subtitle"
    :theme="theme"
    :image-url="imageUrl"
    :features="features"
    :highlight-slug="highlightSlug"
    :badge="badge"
    :cta-label="ctaLabel"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import Landing1View from '../../../landing1/Landing1View.vue';

const props = defineProps<{
  config?: Record<string, unknown>;
}>();

const mode = computed(() => (props.config?.mode as string) || 'category');

const category = computed(() => {
  if (mode.value !== 'category') return undefined;
  // support new format (config.category) and legacy format (config.props.category)
  return (props.config?.category as string | undefined)
    ?? ((props.config?.props as Record<string, unknown> | undefined)?.category as string | undefined);
});

const planSlugs = computed(() => {
  if (mode.value !== 'plans') return undefined;
  const v = props.config?.plan_slugs;
  return Array.isArray(v) ? (v as string[]) : undefined;
});

function str(key: string): string | undefined {
  const v = props.config?.[key];
  return typeof v === 'string' && v.trim() ? v : undefined;
}

const heading = computed(() => str('heading'));
const subtitle = computed(() => str('subtitle'));
const theme = computed(() => str('theme'));
const imageUrl = computed(() => str('image_url'));
const highlightSlug = computed(() => str('highlight_slug'));
const badge = computed(() => str('highlight_badge'));
const ctaLabel = computed(() => str('cta_label'));
const features = computed<string[] | undefined>(() => {
  const v = props.config?.features;
  return Array.isArray(v) ? (v as unknown[]).map((x) => String(x)) : undefined;
});

let styleEl: HTMLStyleElement | null = null;

function applyCSS() {
  if (styleEl) { styleEl.remove(); styleEl = null; }
  const css = props.config?.css as string | undefined;
  if (!css) return;
  styleEl = document.createElement('style');
  styleEl.setAttribute('data-native-pricing-css', '');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}

onMounted(applyCSS);
watch(() => props.config?.css, applyCSS);
onUnmounted(() => { if (styleEl) { styleEl.remove(); styleEl = null; } });
</script>
