<template>
  <div class="term-archive">
    <p
      v-if="showPrompt"
      class="term-archive__hint"
      data-testid="term-archive-prompt"
    >
      {{ $t('cms.termArchive.prompt', 'No term selected.') }}
    </p>

    <template v-else>
      <header class="term-archive__header">
        <h1
          class="term-archive__heading"
          data-testid="term-archive-heading"
        >
          {{ heading }}
        </h1>
        <p
          v-if="termDescription && !isArchiveMode"
          class="term-archive__description"
          data-testid="term-archive-description"
        >
          {{ termDescription }}
        </p>
      </header>

      <p
        v-if="listLoading"
        class="term-archive__loading"
        data-testid="term-archive-loading"
      >
        {{ $t('cms.termArchive.loading', 'Loading…') }}
      </p>

      <p
        v-else-if="!listItems.length"
        class="term-archive__empty"
        data-testid="term-archive-empty"
      >
        <template v-if="isArchiveMode">
          {{ $t('cms.termArchive.emptyArchive', 'No posts in this archive yet.') }}
        </template>
        <template v-else-if="isTag">
          {{ $t('cms.termArchive.emptyTag', 'No posts in this tag yet.') }}
        </template>
        <template v-else>
          {{ $t('cms.termArchive.emptyCategory', 'No posts in this category yet.') }}
        </template>
      </p>

      <template v-else>
        <PostList
          :posts="listItems"
          :display="display"
        />

        <div
          v-if="paginate && !isArchiveMode && posts.pages.value > 1"
          class="term-archive__pagination"
        >
          <button
            type="button"
            data-testid="term-archive-prev"
            :disabled="posts.page.value <= 1"
            @click="goToPage(posts.page.value - 1)"
          >
            ‹
          </button>
          <span class="term-archive__page-indicator">
            {{ posts.page.value }} / {{ posts.pages.value }}
          </span>
          <button
            type="button"
            data-testid="term-archive-next"
            :disabled="posts.page.value >= posts.pages.value"
            @click="goToPage(posts.page.value + 1)"
          >
            ›
          </button>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * The shared, route-driven term-archive widget. ONE instance on the ONE
 * `terms-archive` layout renders EVERY category AND tag archive — the key
 * difference from the config-bound `PostTermList` ("Category") widget, which
 * pins a single term in its config.
 *
 * It reads the term TYPE + SLUG from the catch-all route (`/category/<slug>` or
 * `/tag/<slug>`), not from static config, and lists that term's posts through
 * the single `usePosts.byTerm` fetch path + the DRY `PostList` renderer. The
 * term display NAME / description come from the resolved term the store parked
 * on `currentPage.term_archive` (no second fetch); the route slug is the
 * fallback label. Config (from the widget's `content_json` / `config`):
 *   { type?, mode?, posts_per_page?, paginate? }
 */
import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import PostList from './PostList.vue';
import { usePosts } from '../composables/usePosts';
import { useCmsStore } from '../stores/useCmsStore';
import { readArchiveToggles } from '../utils/archiveDisplay';
import type { PostListMode, PostMetaField } from './PostCard.vue';

interface TermArchiveConfig {
  type?: string;
  mode?: PostListMode;
  posts_per_page?: number;
  paginate?: boolean;
  show_categories?: boolean;
  show_tags?: boolean;
  show_article_size?: boolean;
}

const CATEGORY_TERM_TYPE = 'category';
const TAG_TERM_TYPE = 'tag';
// The catch-all slug for a term archive: a fixed `category/`/`tag/` prefix + the
// term slug (which may be nested). Group 1 = term type, group 2 = term slug.
const TERM_ARCHIVE_SLUG_PATTERN = /^(category|tag)\/(.+)$/;
const DEFAULT_POST_TYPE = 'post';
const DEFAULT_POSTS_PER_PAGE = 20;
const ARCHIVE_META_FIELDS: PostMetaField[] = ['published_at'];

const props = defineProps<{ config?: TermArchiveConfig | null }>();

const route = useRoute();
const store = useCmsStore();
const config = computed<TermArchiveConfig>(() => props.config ?? {});

const postsPerPage = computed(
  () => config.value.posts_per_page ?? DEFAULT_POSTS_PER_PAGE,
);
const posts = usePosts({ perPage: postsPerPage.value });

const paginate = computed(() => config.value.paginate !== false);

const display = computed(() => ({
  mode: config.value.mode ?? ('category' as PostListMode),
  meta: ARCHIVE_META_FIELDS,
  ...readArchiveToggles(config.value),
}));

/** `{ termType, termSlug }` parsed from the catch-all route slug, or null. */
const routeTerm = computed<{ termType: string; termSlug: string } | null>(() => {
  const slug = String(route.params.slug ?? '');
  const match = TERM_ARCHIVE_SLUG_PATTERN.exec(slug);
  if (!match) return null;
  return { termType: match[1], termSlug: match[2] };
});

const termSlug = computed<string>(() => routeTerm.value?.termSlug ?? '');
const termType = computed<string>(() => routeTerm.value?.termType ?? '');
const isTag = computed<boolean>(() => termType.value === TAG_TERM_TYPE);

/** The store-parked resolved term, when it matches the current route slug. */
const resolvedTerm = computed(() => {
  const context = store.currentPage?.term_archive;
  if (!context) return null;
  return context.slug === termSlug.value && context.term_type === termType.value
    ? context
    : null;
});

/** Title-case the leaf slug (`new-arrivals` → `New Arrivals`) as a fallback. */
const termLabelFallback = computed<string>(() => {
  const leaf = termSlug.value.split('/').pop() ?? '';
  return leaf
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
});

const termName = computed<string>(
  () => resolvedTerm.value?.name ?? termLabelFallback.value,
);
const termDescription = computed<string>(
  () => resolvedTerm.value?.description ?? '',
);

// PREFIX-archive mode: a WordPress-style `/blog/2026` listing (no `category/`|
// `tag/` term). The store's `_resolvePrefixArchive` parked the resolved title +
// posts on `currentPage`, so this shared widget lists them WITHOUT a second
// fetch (first page only for now). This is what makes the ONE `terms-archive`
// layout render BOTH term archives and prefix archives, route-driven.
const archivePage = computed(() => {
  if (routeTerm.value) return null;
  const page = store.currentPage;
  return page && page.type === 'archive' && page.archive_prefix ? page : null;
});
const isArchiveMode = computed<boolean>(() => archivePage.value !== null);

/** Show the "no term selected" hint only when neither mode is active. */
const showPrompt = computed<boolean>(() => !termSlug.value && !isArchiveMode.value);

/** Heading: the archive title in archive mode, else the term name. */
const heading = computed<string>(() =>
  isArchiveMode.value ? archivePage.value?.title ?? '' : termName.value,
);

/** Posts to list: parked archive items in archive mode, else the term fetch. */
const listItems = computed(() =>
  isArchiveMode.value ? archivePage.value?.items ?? [] : posts.items.value,
);

/** Archive items are pre-fetched by the store, so never in a loading state. */
const listLoading = computed<boolean>(() =>
  isArchiveMode.value ? false : posts.loading.value,
);

function fetchArchive(pageNumber: number): void {
  if (!termSlug.value) return;
  posts.byTerm(
    config.value.type ?? DEFAULT_POST_TYPE,
    isTag.value ? TAG_TERM_TYPE : CATEGORY_TERM_TYPE,
    termSlug.value,
    pageNumber,
  );
}

function goToPage(pageNumber: number): void {
  if (pageNumber < 1 || pageNumber > posts.pages.value) return;
  fetchArchive(pageNumber);
}

watch(termSlug, () => fetchArchive(1));
onMounted(() => fetchArchive(1));
</script>

<style scoped>
.term-archive {
  width: 100%;
}
.term-archive__header {
  margin: 0 0 1.25rem;
}
.term-archive__heading {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
  color: var(--color-heading, #0f172a);
}
.term-archive__description {
  margin: 0;
  color: var(--color-text-muted, #64748b);
  line-height: 1.55;
}
.term-archive__hint,
.term-archive__loading,
.term-archive__empty {
  color: var(--color-text-muted, #64748b);
  padding: 1.5rem 0;
  text-align: center;
}
.term-archive__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
}
.term-archive__pagination button {
  padding: 0.5rem 1rem;
  cursor: pointer;
}
.term-archive__pagination button:disabled {
  opacity: 0.4;
  cursor: default;
}
.term-archive__page-indicator {
  color: var(--color-text-muted, #64748b);
  font-size: 0.9rem;
}
</style>
