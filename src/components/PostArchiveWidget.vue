<template>
  <div class="post-archive-widget">
    <PostList
      :posts="posts.items.value"
      :display="display"
    />

    <div
      v-if="paginate && posts.pages.value > 1"
      class="post-archive-widget__pagination"
    >
      <button
        type="button"
        data-testid="post-archive-prev"
        :disabled="posts.page.value <= 1"
        @click="goToPage(posts.page.value - 1)"
      >
        ‹
      </button>
      <span class="post-archive-widget__page-indicator">
        {{ posts.page.value }} / {{ posts.pages.value }}
      </span>
      <button
        type="button"
        data-testid="post-archive-next"
        :disabled="posts.page.value >= posts.pages.value"
        @click="goToPage(posts.page.value + 1)"
      >
        ›
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The "PostArchive" (blog index) widget. Registered in the cms
 * `vueComponentRegistry` as `PostArchive`; an admin drops a `vue-component`
 * widget onto the posts-archive page/layout and it lists EVERY published post
 * of the configured type — no term filter (unlike the Category widget). Config
 * comes from the widget's `content_json` (passed via the widget renderer's
 * `:config` bind):
 *   { type, mode, posts_per_page, paginate }
 * Fetching is delegated to the single unfiltered `usePosts.byType` path;
 * rendering to the DRY `PostList` (which owns the "No posts yet" empty state).
 */
import { computed, onMounted, watch } from 'vue';
import PostList from './PostList.vue';
import { usePosts } from '../composables/usePosts';
import type { PostListMode, PostMetaField } from './PostCard.vue';

interface PostArchiveConfig {
  type?: string;
  mode?: PostListMode;
  posts_per_page?: number;
  paginate?: boolean;
}

/** Matches the CMS `posts_per_page` config default (backend config.json). */
const DEFAULT_POSTS_PER_PAGE = 20;
const DEFAULT_POST_TYPE = 'post';
const ARCHIVE_META_FIELDS: PostMetaField[] = ['published_at'];

const props = defineProps<{ config?: PostArchiveConfig | null }>();

const config = computed<PostArchiveConfig>(() => props.config ?? {});

const postType = computed(() => config.value.type ?? DEFAULT_POST_TYPE);
const postsPerPage = computed(
  () => config.value.posts_per_page ?? DEFAULT_POSTS_PER_PAGE,
);
const paginate = computed(() => config.value.paginate !== false);

const posts = usePosts({ perPage: postsPerPage.value });

const display = computed(() => ({
  mode: config.value.mode ?? ('category' as PostListMode),
  meta: ARCHIVE_META_FIELDS,
}));

function fetchArchive(pageNumber: number): void {
  posts.byType(postType.value, pageNumber);
}

function goToPage(pageNumber: number): void {
  if (pageNumber < 1 || pageNumber > posts.pages.value) return;
  fetchArchive(pageNumber);
}

watch(config, () => fetchArchive(1));
onMounted(() => fetchArchive(1));
</script>

<style scoped>
.post-archive-widget {
  width: 100%;
}
.post-archive-widget__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
}
.post-archive-widget__pagination button {
  padding: 0.5rem 1rem;
  cursor: pointer;
}
.post-archive-widget__pagination button:disabled {
  opacity: 0.4;
  cursor: default;
}
.post-archive-widget__page-indicator {
  color: var(--color-text-muted, #64748b);
  font-size: 0.9rem;
}
</style>
