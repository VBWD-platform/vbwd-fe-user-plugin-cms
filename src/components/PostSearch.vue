<template>
  <div
    ref="rootRef"
    class="post-search"
  >
    <form
      class="post-search__form"
      role="search"
      @submit.prevent="onSubmit"
    >
      <input
        v-model="term"
        type="search"
        class="post-search__input"
        :placeholder="placeholder"
        data-testid="post-search-input"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="showDropdown"
        :aria-controls="listboxId"
        :aria-activedescendant="activeDescendant"
        @input="syncDebounced"
        @keydown.down.prevent="moveActive(1)"
        @keydown.up.prevent="moveActive(-1)"
        @keydown.esc="closeDropdown"
      >
    </form>

    <ul
      v-if="showDropdown"
      :id="listboxId"
      class="post-search__dropdown"
      role="listbox"
      data-testid="post-search-dropdown"
    >
      <li
        v-for="(result, index) in results"
        :id="optionId(index)"
        :key="result.id"
        class="post-search__option"
        :class="{ 'post-search__option--active': index === activeIndex }"
        role="option"
        :aria-selected="index === activeIndex"
        data-testid="post-search-option"
        @mousedown.prevent="openResult(result)"
        @mouseenter="activeIndex = index"
      >
        {{ result.title }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
/**
 * S47.4 / S121 — the "Search" box widget. Registered in the cms
 * `vueComponentRegistry` as `Search`.
 *
 * By default (`quicksearch:false`) it owns NO results: on submit/typing it
 * URL-syncs `?q=` (the shareable, back-buttonable seam) and — when `target_path`
 * is set — navigates to the page hosting the `SearchResults` widget. The two
 * widgets stay fully decoupled and compose across pages purely through the URL
 * param. This path is unchanged from S47.4.
 *
 * S121 adds an opt-in **quicksearch** dropdown (`quicksearch:true`): the same
 * 350 ms-debounced input instead fetches the top `quicksearch_limit` results
 * from `/cms/search` (scoped via `scope`→`type`) and renders a keyboard-navigable
 * listbox below the input, so a single box works standalone on a docs layout.
 * State is a small local ref — deliberately no store, preserving the decoupling.
 *
 * Config (from the widget's `content_json`):
 *   { placeholder?, target_path?, scope?, quicksearch?, quicksearch_limit? }
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePosts, type PostSummary } from '../composables/usePosts';
import { scopeToType, type SearchScope } from '../utils/searchScope';

interface SearchConfig {
  placeholder?: string;
  target_path?: string;
  scope?: SearchScope;
  quicksearch?: boolean;
  quicksearch_limit?: number;
}

const props = defineProps<{ config?: SearchConfig | null }>();

const route = useRoute();
const router = useRouter();

const DEBOUNCE_MS = 350;
const QUICKSEARCH_DEFAULT_LIMIT = 6;
const QUICKSEARCH_MAX_LIMIT = 20;

const config = computed<SearchConfig>(() => props.config ?? {});
const placeholder = computed(() => config.value.placeholder ?? 'Search…');
const quicksearchEnabled = computed(() => config.value.quicksearch === true);

const quicksearchLimit = computed(() => {
  const raw = config.value.quicksearch_limit ?? QUICKSEARCH_DEFAULT_LIMIT;
  if (!Number.isFinite(raw)) return QUICKSEARCH_DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(raw)), QUICKSEARCH_MAX_LIMIT);
});

// Seed from an existing ?q= so a shared/bookmarked URL pre-fills the box.
const term = ref<string>((route.query.q as string) ?? '');

// Quicksearch-only local state (no store — keeps the widget self-contained).
const posts = usePosts({ perPage: quicksearchLimit.value });
const results = ref<PostSummary[]>([]);
const open = ref(false);
const activeIndex = ref(-1);

const rootRef = ref<HTMLElement | null>(null);
const listboxId = `post-search-listbox-${Math.random().toString(36).slice(2, 8)}`;

const showDropdown = computed(
  () => quicksearchEnabled.value && open.value && results.value.length > 0,
);
const activeDescendant = computed(() =>
  showDropdown.value && activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined,
);

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function optionId(index: number): string {
  return `${listboxId}-option-${index}`;
}

function syncNow(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  const path = config.value.target_path ?? route.path;
  router.push({ path, query: { q: term.value } });
}

async function fetchQuicksearch(): Promise<void> {
  const query = term.value.trim();
  if (!query) {
    results.value = [];
    closeDropdown();
    return;
  }
  const result = await posts.bySearch(query, 1, {
    type: scopeToType(config.value.scope),
  });
  results.value = (result?.items ?? []).slice(0, quicksearchLimit.value);
  activeIndex.value = -1;
  open.value = results.value.length > 0;
}

function syncDebounced(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (quicksearchEnabled.value) {
      void fetchQuicksearch();
    } else {
      syncNow();
    }
  }, DEBOUNCE_MS);
}

function moveActive(delta: number): void {
  if (!showDropdown.value) return;
  const count = results.value.length;
  activeIndex.value = (activeIndex.value + delta + count) % count;
}

function closeDropdown(): void {
  open.value = false;
  activeIndex.value = -1;
}

function openResult(result: PostSummary): void {
  closeDropdown();
  router.push(`/${result.slug}`);
}

function onSubmit(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  // Enter on an active dropdown row opens that result (instant-answer flow);
  // Enter with no active row keeps the classic ?q= + target_path submit.
  if (quicksearchEnabled.value && activeIndex.value >= 0 && results.value[activeIndex.value]) {
    openResult(results.value[activeIndex.value]);
    return;
  }
  syncNow();
}

function onDocumentClick(event: MouseEvent): void {
  if (!open.value) return;
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    closeDropdown();
  }
}

onMounted(() => {
  if (quicksearchEnabled.value && typeof document !== 'undefined') {
    document.addEventListener('click', onDocumentClick);
  }
});

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (typeof document !== 'undefined') {
    document.removeEventListener('click', onDocumentClick);
  }
});
</script>

<style scoped>
.post-search {
  position: relative;
  width: 100%;
}
.post-search__form {
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
.post-search__dropdown {
  position: absolute;
  z-index: 20;
  left: 0;
  right: 0;
  margin: 0.25rem 0 0;
  padding: 0.25rem 0;
  list-style: none;
  border: 1px solid var(--vbwd-input-border, #cbd5e1);
  border-radius: var(--vbwd-input-radius, 6px);
  background: var(--vbwd-surface, #fff);
  box-shadow: var(--vbwd-shadow-md, 0 6px 20px rgba(15, 23, 42, 0.12));
  max-height: 24rem;
  overflow-y: auto;
}
.post-search__option {
  padding: 0.5rem 0.9rem;
  cursor: pointer;
  color: var(--vbwd-input-text, #0f172a);
}
.post-search__option--active,
.post-search__option:hover {
  background: var(--vbwd-surface-hover, var(--color-surface-hover, #f1f5f9));
}
</style>
