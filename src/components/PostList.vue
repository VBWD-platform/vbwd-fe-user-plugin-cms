<template>
  <div
    class="post-list"
    :class="`post-list--${mode}`"
  >
    <p
      v-if="!posts.length"
      class="post-list__empty"
      data-testid="post-list-empty"
    >
      {{ $t('cms.postList.empty', 'No posts yet.') }}
    </p>

    <template v-else>
      <PostCard
        v-for="post in posts"
        :key="post.id"
        :post="post"
        :display="display"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import PostCard, { type PostListMode, type PostMetaField } from './PostCard.vue';
import type { PostSummary } from '../composables/usePosts';

/**
 * S47.3 — the DRY spine. Generic, data-in via props (does NOT fetch). Every
 * source (the Category widget today, search results in 47.4) passes its
 * already-fetched summaries + a `display` config → one render path.
 */
interface PostDisplay {
  mode?: PostListMode;
  meta?: PostMetaField[];
}

const props = defineProps<{
  posts: PostSummary[];
  display?: PostDisplay;
}>();

const mode = computed<PostListMode>(() => props.display?.mode ?? 'titles');
</script>

<style scoped>
.post-list {
  display: block;
}
.post-list--gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}
.post-list__empty {
  color: var(--color-text-muted, #64748b);
  padding: 1.5rem 0;
  text-align: center;
}
</style>
