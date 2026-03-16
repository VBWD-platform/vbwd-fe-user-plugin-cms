<template>
  <div
    class="cms-layout"
    :class="`cms-layout--${layout.slug}`"
  >
    <template
      v-for="area in layout.areas"
      :key="area.name"
    >
      <!-- Content area: render page TipTap content -->
      <main
        v-if="area.type === 'content'"
        class="cms-area cms-area--content"
      >
        <div class="container">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            ref="contentAreaEl"
            class="cms-page__body"
            v-html="contentHtml"
          />
        </div>
      </main>

      <!-- Widget area -->
      <div
        v-else-if="widgetFor(area.name)"
        :class="`cms-area cms-area--${area.type}`"
      >
        <CmsWidgetRenderer :widget="widgetFor(area.name)!" />
      </div>

      <!-- Declared area with no widget assignment: skip silently -->
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue';
import type { CmsLayout, CmsWidgetData } from '../stores/useCmsStore';
import CmsWidgetRenderer from './CmsWidgetRenderer.vue';

const props = defineProps<{
  layout: CmsLayout;
  contentHtml: string;
}>();

const contentAreaEl = ref<HTMLElement | HTMLElement[] | null>(null);

function runScripts(container: HTMLElement) {
  container.querySelectorAll('script').forEach(old => {
    const s = document.createElement('script');
    if (old.src) {
      Array.from(old.attributes).forEach(a => s.setAttribute(a.name, a.value));
    } else {
      s.textContent = old.textContent;
    }
    old.replaceWith(s);
  });
}

function getContentEl(): HTMLElement | null {
  const v = Array.isArray(contentAreaEl.value) ? contentAreaEl.value[0] : contentAreaEl.value;
  return v instanceof HTMLElement ? v : null;
}

onMounted(async () => {
  await nextTick();
  const el = getContentEl();
  if (el) runScripts(el);
});

watch(() => props.contentHtml, async () => {
  await nextTick();
  const el = getContentEl();
  if (el) runScripts(el);
});

function widgetFor(areaName: string): CmsWidgetData | undefined {
  const assignment = props.layout.assignments?.find(a => a.area_name === areaName);
  return assignment?.widget as CmsWidgetData | undefined;
}
</script>

<style scoped>
.cms-layout { width: 100%; }
.cms-area { width: 100%; }
.cms-area--content { padding: 3rem 0; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }
.cms-page__body :deep(img) { max-width: 100%; height: auto; }
.cms-page__body :deep(pre) { background: var(--color-surface, #f5f5f5); padding: 1rem; border-radius: 4px; overflow-x: auto; }
.cms-page__body :deep(blockquote) { border-left: 4px solid var(--color-border, #ddd); margin: 0; padding-left: 1rem; opacity: 0.8; }
</style>
