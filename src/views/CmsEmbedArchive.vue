<template>
  <div class="cms-embed-archive">
    <div
      v-if="loading"
      class="cms-embed-archive__loading"
    >
      {{ $t('cms.loading', 'Loading…') }}
    </div>

    <!-- Unknown / empty category: fail loud, never a blank page (mirrors the
         backend embed-manifest 404). -->
    <div
      v-else-if="isEmpty"
      class="cms-embed-archive__empty"
      data-testid="cms-embed-archive-empty"
      role="alert"
    >
      <h1 class="cms-embed-archive__empty-title">
        {{ $t('cms.embed.notFoundTitle', 'No posts found') }}
      </h1>
      <p class="cms-embed-archive__empty-message">
        {{ $t('cms.embed.notFoundMessage', 'This category has no posts, or does not exist.') }}
      </p>
    </div>

    <template v-else>
      <PostList
        :posts="items"
        :display="display"
        :detail-base="detailBase"
      />

      <div
        v-if="pages > 1"
        class="cms-embed-archive__pagination"
      >
        <button
          type="button"
          data-testid="cms-embed-archive-prev"
          :disabled="page <= 1"
          @click="goToPage(page - 1)"
        >
          ‹
        </button>
        <span class="cms-embed-archive__page-indicator">{{ page }} / {{ pages }}</span>
        <button
          type="button"
          data-testid="cms-embed-archive-next"
          :disabled="page >= pages"
          @click="goToPage(page + 1)"
        >
          ›
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * S91 Slice 1 — the chrome-light embedded category archive a mobile WebView
 * loads. It is rendered with `meta.embed` so the host App.vue drops the global
 * nav/burger/footer. It reuses the single `usePosts.byTerm` fetch path and the
 * DRY `PostList`/`PostCard` renderer; post cards link back into embed mode via
 * the `detailBase` prop so taps stay inside `/cms/embed/<type>/post/<slug>`.
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import PostList from '../components/PostList.vue';
import { usePosts } from '../composables/usePosts';
import type { PostMetaField } from '../components/PostCard.vue';

const CATEGORY_TERM_TYPE = 'category';
const ARCHIVE_META_FIELDS: PostMetaField[] = ['published_at'];

const route = useRoute();

const postType = computed(() => String(route.params.type ?? ''));
const categorySlug = computed(() => String(route.params.category ?? ''));

const { items, page, pages, total, loading, byTerm } = usePosts();

const display = computed(() => ({
  mode: 'excerpt' as const,
  meta: ARCHIVE_META_FIELDS,
}));

/** Post cards link back into embed mode, never the full-chrome `/<slug>`. */
const detailBase = computed(() => `/cms/embed/${postType.value}/post/`);

// `null` until the first fetch resolves; distinguishes "loading" from
// "loaded and genuinely empty" so the not-found state only shows post-fetch.
const fetchResolved = ref(false);

const isEmpty = computed(() => fetchResolved.value && total.value === 0);

async function fetchArchive(pageNumber: number): Promise<void> {
  fetchResolved.value = false;
  await byTerm(postType.value, CATEGORY_TERM_TYPE, categorySlug.value, pageNumber);
  fetchResolved.value = true;
}

function goToPage(pageNumber: number): void {
  if (pageNumber < 1 || pageNumber > pages.value) return;
  fetchArchive(pageNumber);
}

onMounted(() => fetchArchive(1));
</script>

<style scoped>
/* Mobile-first: a fluid, narrow container that never forces a desktop width
 * onto a phone WebView. Keeps the site's resolved CMS style (injected by the
 * detail/page renderer) untouched. */
.cms-embed-archive {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 1rem;
  box-sizing: border-box;
}
.cms-embed-archive__loading {
  color: var(--color-text-muted, #64748b);
  padding: 2rem 0;
  text-align: center;
}
.cms-embed-archive__empty {
  padding: 2.5rem 1rem;
  text-align: center;
}
.cms-embed-archive__empty-title {
  font-size: clamp(1.25rem, 4vw, 1.6rem);
  color: var(--color-heading, #0f172a);
  margin: 0 0 0.5rem;
}
.cms-embed-archive__empty-message {
  color: var(--color-text-muted, #64748b);
  margin: 0;
}
.cms-embed-archive__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
}
.cms-embed-archive__pagination button {
  padding: 0.5rem 1rem;
  cursor: pointer;
}
.cms-embed-archive__pagination button:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
