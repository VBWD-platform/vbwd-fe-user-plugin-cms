<template>
  <div class="tag-archive">
    <p
      v-if="!tagSlug"
      class="tag-archive__hint"
      data-testid="tag-archive-prompt"
    >
      {{ $t('cms.tagArchive.prompt', 'Select a tag.') }}
    </p>

    <template v-else>
      <h1
        class="tag-archive__heading"
        data-testid="tag-archive-heading"
      >
        {{ $t('cms.tagArchive.heading', { tag: tagLabel }) }}
      </h1>

      <p
        v-if="posts.loading.value"
        class="tag-archive__loading"
        data-testid="tag-archive-loading"
      >
        {{ $t('cms.tagArchive.loading', 'Loading…') }}
      </p>

      <p
        v-else-if="!posts.items.value.length"
        class="tag-archive__empty"
        data-testid="tag-archive-empty"
      >
        {{ $t('cms.tagArchive.empty', 'No posts found for this tag.') }}
      </p>

      <PostList
        v-else
        :posts="posts.items.value"
        :display="display"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * URL-driven tag-archive widget. Registered in the cms `vueComponentRegistry`
 * as `TagArchive`. It reads `?tag=` from the URL (written by the post tag chips,
 * possibly on another page), delegates fetching to the
 * single `usePosts.byTerm` path, and renders matches through the DRY `PostList`
 * — identical cards to the Category widget. No-tag / loading / empty states are
 * handled here. Only the tag *slug* is in the URL, so the heading title-cases
 * the slug as a friendly fallback label.
 *
 * Config (from the widget's `content_json`):
 *   { type?, term_type?, mode, meta[], limit }
 */
import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import PostList from './PostList.vue';
import { usePosts } from '../composables/usePosts';
import type { PostListMode, PostMetaField } from './PostCard.vue';

interface TagArchiveConfig {
  type?: string;
  term_type?: string;
  mode?: PostListMode;
  meta?: PostMetaField[];
  limit?: number;
}

const props = defineProps<{ config?: TagArchiveConfig | null }>();

const route = useRoute();
const config = computed<TagArchiveConfig>(() => props.config ?? {});

const posts = usePosts({ perPage: config.value.limit });

const tagSlug = computed<string>(() => ((route.query.tag as string) ?? '').trim());

const display = computed(() => ({
  mode: config.value.mode ?? 'excerpt',
  meta: config.value.meta ?? [],
}));

/** Title-case the slug (`getting-started` → `Getting Started`) for the label. */
const tagLabel = computed<string>(() =>
  tagSlug.value
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' '),
);

function fetchPosts(): void {
  if (!tagSlug.value) return;
  posts.byTerm(
    config.value.type ?? 'post',
    config.value.term_type ?? 'tag',
    tagSlug.value,
    1,
  );
}

watch(tagSlug, fetchPosts);
onMounted(fetchPosts);
</script>

<style scoped>
.tag-archive {
  width: 100%;
}
.tag-archive__heading {
  margin: 0 0 1rem;
  font-size: 1.5rem;
  color: var(--color-text, #0f172a);
}
.tag-archive__hint,
.tag-archive__loading,
.tag-archive__empty {
  color: var(--color-text-muted, #64748b);
  padding: 1.5rem 0;
  text-align: center;
}
</style>
