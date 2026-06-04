<template>
  <!-- eslint-disable vue/no-v-html -->
  <div
    class="cms-richtext"
    v-html="html"
  />
  <!-- eslint-enable vue/no-v-html -->
</template>

<script setup lang="ts">
/**
 * S47.3 — the built-in `richtext` content-type renderer (placement: inline).
 * A post with no blocks renders its `content_html` as one implicit richtext
 * block (back-compat) — `content_html` stays the crawlable body in the
 * prerender, so this is the same markup bots see.
 */
import { computed } from 'vue';

const props = defineProps<{ data: { html?: string | null } }>();
const html = computed(() => props.data?.html ?? '');
</script>

<style scoped>
.cms-richtext :deep(img) {
  max-width: 100%;
  height: auto;
}
.cms-richtext :deep(pre) {
  overflow-x: auto;
}
</style>
