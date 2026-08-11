<template>
  <div class="cms-richtext-root">
    <!-- eslint-disable vue/no-v-html -->
    <div
      ref="bodyEl"
      class="cms-richtext"
      v-html="html"
      @click="onContainerClick"
    />
    <!-- eslint-enable vue/no-v-html -->

    <ImageLightbox
      v-if="active"
      v-model="zoomIndex"
      :image="active"
      @close="close"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * S47.3 — the built-in `richtext` content-type renderer (placement: inline).
 * A post with no blocks renders its `content_html` as one implicit richtext
 * block (back-compat) — `content_html` stays the crawlable body in the
 * prerender, so this is the same markup bots see.
 *
 * Images in the body open in the shared zoom/pan viewer (`useImageZoom`), the
 * same one CmsWidgetRenderer uses, so behaviour does not fork between the two
 * ways CMS body copy reaches a page.
 */
import { computed, ref } from 'vue';
import ImageLightbox from './ImageLightbox.vue';
import { useImageZoom } from '../composables/useImageZoom';

const props = defineProps<{ data: { html?: string | null } }>();
const html = computed(() => props.data?.html ?? '');

const bodyEl = ref<HTMLElement | null>(null);
const { active, zoomIndex, onContainerClick, close } = useImageZoom(bodyEl, html);
</script>

<style scoped>
.cms-richtext :deep(img) {
  max-width: 100%;
  height: auto;
}
.cms-richtext :deep(pre) {
  overflow-x: auto;
}
.cms-richtext :deep(img.is-zoomable) {
  cursor: zoom-in;
}
</style>
