<template>
  <Landing1View
    :category="category"
    :plan-slugs="planSlugs"
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
