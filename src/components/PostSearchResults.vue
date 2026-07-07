<template>
  <div class="post-search-results">
    <p
      v-if="!query"
      class="post-search-results__hint"
      data-testid="search-empty-query"
    >
      {{ $t('cms.search.prompt', 'Type a search term to begin.') }}
    </p>

    <template v-else>
      <p
        v-if="posts.loading.value"
        class="post-search-results__loading"
        data-testid="search-loading"
      >
        {{ $t('cms.search.loading', 'Searching…') }}
      </p>

      <p
        v-else-if="!posts.items.value.length"
        class="post-search-results__empty"
        data-testid="search-no-results"
      >
        {{ $t('cms.search.noResults', 'No results found.') }}
      </p>

      <template v-else>
        <p
          class="post-search-results__count"
          data-testid="search-result-count"
        >
          {{ resultCountLabel }}
        </p>
        <PostList
          :posts="posts.items.value"
          :display="display"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * S47.4 — the "Search-results" widget. Registered in the cms
 * `vueComponentRegistry` as `SearchResults`. It reads `?q=` from the URL
 * (written by the decoupled `Search` box, possibly on another page), delegates
 * fetching to the single `usePosts.bySearch` path, and renders matches through
 * the DRY `PostList` (47.3) — identical cards to the Category widget. Loading /
 * empty-query / no-results states are handled here. The hosting cms page is
 * `noindex` + sitemap-omitted (D8); that's page config, not this component.
 *
 * Config (from the widget's `content_json`):
 *   { type?, mode, meta[], per_page, scope_term_type?, scope_term_slug? }
 */
import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import PostList from './PostList.vue';
import { usePosts } from '../composables/usePosts';
import { scopeToType, resolveSearchTypes, type SearchScope } from '../utils/searchScope';
import type { PostListMode, PostMetaField } from './PostCard.vue';

interface SearchResultsConfig {
  /**
   * Multi-type scope: an explicit set of registered post-type keys to include
   * (e.g. `['page', 'post']`). When non-empty it supersedes `scope`/`type` and
   * is sent as the `types` request filter.
   */
  types?: string[];
  /** S121 published-set scope. Replaces the legacy free-text `type`. */
  scope?: SearchScope;
  /** @deprecated pre-S121 free-text post type; still honoured via `scope` fallback. */
  type?: string;
  mode?: PostListMode;
  meta?: PostMetaField[];
  per_page?: number;
  scope_term_type?: string;
  scope_term_slug?: string;
}

const props = defineProps<{ config?: SearchResultsConfig | null }>();

const route = useRoute();
const config = computed<SearchResultsConfig>(() => props.config ?? {});

const posts = usePosts({ perPage: config.value.per_page });

const query = computed<string>(() => ((route.query.q as string) ?? '').trim());

const display = computed(() => ({
  mode: config.value.mode ?? 'titles',
  meta: config.value.meta ?? [],
}));

// Google-style results summary line, e.g. Showing 12 results for "ai".
const resultCountLabel = computed<string>(() => {
  const total = posts.total.value;
  const noun = total === 1 ? 'result' : 'results';
  return `Showing ${total} ${noun} for "${query.value}"`;
});

function runSearch(): void {
  if (!query.value) return;
  const types = resolveSearchTypes(config.value);
  const typeScope = types.length
    ? { types }
    : { type: scopeToType(config.value.scope, config.value.type) };
  posts.bySearch(query.value, 1, {
    ...typeScope,
    termType: config.value.scope_term_type,
    termSlug: config.value.scope_term_slug,
  });
}

watch(query, runSearch);
onMounted(runSearch);
</script>

<style scoped>
.post-search-results {
  width: 100%;
  /* Breathing room between the search box widget above and the first result. */
  margin-top: 1.75rem;
}
.post-search-results__count {
  margin: 0 0 1.25rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--vbwd-border, var(--color-border, #e5e9f0));
  font-size: 0.85rem;
  color: var(--vbwd-muted, var(--color-text-muted, #64748b));
}
.post-search-results__hint,
.post-search-results__loading,
.post-search-results__empty {
  color: var(--color-text-muted, #64748b);
  padding: 1.5rem 0;
  text-align: center;
}
</style>
