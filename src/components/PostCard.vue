<template>
  <article
    class="post-card"
    :class="`post-card--${mode}`"
    data-testid="post-card"
  >
    <router-link
      v-if="leadImageUrl"
      :to="detailPath"
      class="post-card__media"
    >
      <CmsImage
        :src="leadImageUrl"
        :width="leadImageWidth"
        :height="leadImageHeight"
        :alt="post.title"
      />
    </router-link>

    <h2 class="post-card__title">
      <router-link :to="detailPath">
        {{ post.title }}
      </router-link>
    </h2>

    <div
      v-if="metaFields.length"
      class="post-card__meta"
      data-testid="post-meta"
    >
      <span
        v-for="field in metaFields"
        :key="field"
        class="post-card__meta-item"
        :class="`post-card__meta-item--${field}`"
      >{{ metaValue(field) }}</span>
    </div>

    <p
      v-if="showExcerpt && post.excerpt"
      class="post-card__excerpt"
    >
      {{ post.excerpt }}
    </p>

    <!-- eslint-disable vue/no-v-html -->
    <div
      v-if="showFull && post.content_html"
      class="post-card__body"
      v-html="post.content_html"
    />
    <!-- eslint-enable vue/no-v-html -->
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import CmsImage from './CmsImage.vue';
import { timeAgo } from '../utils/timeAgo';
import type { PostSummary } from '../composables/usePosts';

export type PostListMode = 'titles' | 'excerpt' | 'full' | 'gallery' | 'video';
export type PostMetaField =
  | 'author'
  | 'time_ago'
  | 'tags'
  | 'published_at'
  | 'reading_time';

interface PostDisplay {
  mode?: PostListMode;
  meta?: PostMetaField[];
}

const props = defineProps<{
  post: PostSummary;
  display?: PostDisplay;
  /**
   * Optional base path for the detail link. When supplied (e.g. the embed
   * archive passes `/cms/embed/<type>/post/`), the card links to
   * `<detailBase><slug>` so navigation stays in embed mode. When absent the
   * card keeps its default `/<slug>` site link (unchanged for every existing
   * usage — the Category/Tag/Search widgets).
   */
  detailBase?: string;
}>();

// Default lead-image dimensions when the source does not carry them; explicit
// dims are mandatory (CLS) — a 16:9 placeholder ratio is a safe default.
const DEFAULT_LEAD_WIDTH = 1200;
const DEFAULT_LEAD_HEIGHT = 675;
const WORDS_PER_MINUTE = 200;

const mode = computed<PostListMode>(() => props.display?.mode ?? 'titles');
const metaFields = computed<PostMetaField[]>(() => props.display?.meta ?? []);

const showExcerpt = computed(
  () => mode.value === 'excerpt' || mode.value === 'full',
);
const showFull = computed(() => mode.value === 'full');

const detailPath = computed(() =>
  props.detailBase
    ? `${props.detailBase}${props.post.slug}`
    : `/${props.post.slug}`,
);

const leadImageUrl = computed(() => props.post.og_image_url ?? null);
const leadImageWidth = computed(
  () => (props.post.og_image_width as number | undefined) ?? DEFAULT_LEAD_WIDTH,
);
const leadImageHeight = computed(
  () => (props.post.og_image_height as number | undefined) ?? DEFAULT_LEAD_HEIGHT,
);

function readingTimeMinutes(): number {
  const html = props.post.content_html ?? '';
  const text = html.replace(/<[^>]*>/g, ' ').trim();
  const words = text ? text.split(/\s+/).length : 0;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

function metaValue(field: PostMetaField): string {
  switch (field) {
    case 'author':
      return (props.post.author_name as string | undefined) ?? props.post.author_id ?? '';
    case 'time_ago':
      return timeAgo(props.post.published_at);
    case 'tags':
      return Array.isArray(props.post.tags)
        ? (props.post.tags as Array<{ name?: string } | string>)
            .map((tag) => (typeof tag === 'string' ? tag : tag.name ?? ''))
            .filter(Boolean)
            .join(', ')
        : '';
    case 'published_at':
      return props.post.published_at
        ? new Date(props.post.published_at).toLocaleDateString()
        : '';
    case 'reading_time':
      return `${readingTimeMinutes()} min`;
    default:
      return '';
  }
}
</script>

<style scoped>
.post-card {
  margin: 0 0 1.5rem;
}
.post-card__media {
  display: block;
  margin-bottom: 0.75rem;
}
.post-card__title {
  margin: 0 0 0.35rem;
  font-size: 1.25rem;
}
.post-card__title a {
  color: var(--color-heading, #0f172a);
  text-decoration: none;
}
.post-card__title a:hover {
  text-decoration: underline;
}
.post-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--color-text-muted, #64748b);
  margin-bottom: 0.5rem;
}
.post-card__excerpt {
  margin: 0;
  color: var(--color-text, #334155);
  line-height: 1.55;
}
.post-card__body :deep(img) {
  max-width: 100%;
  height: auto;
}
</style>
