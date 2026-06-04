<template>
  <form
    class="post-search"
    role="search"
    @submit.prevent="syncNow"
  >
    <input
      v-model="term"
      type="search"
      class="post-search__input"
      :placeholder="placeholder"
      data-testid="post-search-input"
      @input="syncDebounced"
    >
  </form>
</template>

<script setup lang="ts">
/**
 * S47.4 — the "Search" box widget. Registered in the cms `vueComponentRegistry`
 * as `Search`. It owns NO results: on submit/typing it URL-syncs `?q=` (the
 * shareable, back-buttonable seam) and — when `target_path` is set — navigates
 * to the page that hosts the `SearchResults` widget. The two widgets stay fully
 * decoupled and compose across pages purely through the URL param.
 *
 * Config (from the widget's `content_json`):
 *   { placeholder?, target_path? }
 */
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

interface SearchConfig {
  placeholder?: string;
  target_path?: string;
}

const props = defineProps<{ config?: SearchConfig | null }>();

const route = useRoute();
const router = useRouter();

const DEBOUNCE_MS = 350;

const config = computed<SearchConfig>(() => props.config ?? {});
const placeholder = computed(() => config.value.placeholder ?? 'Search…');

// Seed from an existing ?q= so a shared/bookmarked URL pre-fills the box.
const term = ref<string>((route.query.q as string) ?? '');

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function syncNow(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  const path = config.value.target_path ?? route.path;
  router.push({ path, query: { q: term.value } });
}

function syncDebounced(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(syncNow, DEBOUNCE_MS);
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<style scoped>
.post-search {
  width: 100%;
}
.post-search__input {
  width: 100%;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--vbwd-input-border, #cbd5e1);
  border-radius: var(--vbwd-input-radius, 6px);
  background: var(--vbwd-input-bg, #fff);
  color: var(--vbwd-input-text, #0f172a);
  font-size: 1rem;
}
</style>
