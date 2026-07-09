<template>
  <div class="post-term-list-widget">
    <a
      v-if="rssHref"
      class="post-term-list-widget__rss"
      :href="rssHref"
      data-testid="post-term-rss-link"
      :title="$t('cms.rss.subscribe', 'Subscribe to this feed')"
    >
      <span aria-hidden="true">🔖</span>
      {{ $t('cms.rss.label', 'RSS') }}
    </a>
    <PostList
      :posts="posts.items.value"
      :display="display"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * S47.3 — the "Category" (term-list) widget. Registered in the cms
 * `vueComponentRegistry` as `Category` / `PostTermList`; an admin drops a
 * `vue-component` widget onto any cms page and it lists that term's published
 * posts. Archives are CSR (D8) — no bespoke route. Config comes from the
 * widget's `content_json` (passed via the widget renderer's `:config` bind):
 *   { type, term_type, term_slug, mode, meta[], limit, paginate }
 * Fetching is delegated to the single `usePosts.byTerm` path; rendering to the
 * DRY `PostList`.
 */
import { computed, onMounted, onUnmounted, watch } from 'vue';
import PostList from './PostList.vue';
import { usePosts } from '../composables/usePosts';
import {
  rssFeedHref,
  injectRssAutodiscovery,
} from '../composables/useSeoHandoff';
import { readArchiveToggles } from '../utils/archiveDisplay';
import type { PostListMode, PostMetaField } from './PostCard.vue';

interface TermListConfig {
  type?: string;
  term_type?: string;
  term_slug?: string;
  mode?: PostListMode;
  meta?: PostMetaField[];
  limit?: number;
  paginate?: boolean;
  widget_slug?: string;
  show_categories?: boolean;
  show_tags?: boolean;
  show_article_size?: boolean;
}

const props = defineProps<{ config?: TermListConfig | null }>();

const config = computed<TermListConfig>(() => props.config ?? {});

const posts = usePosts({ perPage: config.value.limit });

const display = computed(() => ({
  mode: config.value.mode ?? 'titles',
  meta: config.value.meta ?? [],
  ...readArchiveToggles(config.value),
}));

/** The current term's feed URL (null when the term config is incomplete). */
const rssHref = computed<string | null>(() => {
  const { type, term_type: termType, term_slug: termSlug } = config.value;
  if (!type || !termType || !termSlug) return null;
  return rssFeedHref({ type, termType, termSlug });
});

function fetchPosts(): void {
  const { type, term_type: termType, term_slug: termSlug } = config.value;
  if (!type || !termType || !termSlug) return;
  posts.byTerm(type, termType, termSlug, 1);
}

/**
 * Advertise this term's feed (+ the whole-blog feed) for browser/reader
 * autodiscovery via the shared SEO head path. Re-runs on config change so the
 * head always reflects the term currently shown.
 */
function advertiseFeeds(): void {
  if (!rssHref.value) {
    injectRssAutodiscovery([]);
    return;
  }
  const { type, term_type: termType, term_slug: termSlug } = config.value;
  injectRssAutodiscovery([
    { title: 'Blog', href: rssFeedHref({ type }) },
    { title: termSlug ?? '', href: rssFeedHref({ type, termType, termSlug }) },
  ]);
}

watch(config, () => {
  fetchPosts();
  advertiseFeeds();
});
onMounted(() => {
  fetchPosts();
  advertiseFeeds();
});
onUnmounted(() => injectRssAutodiscovery([]));
</script>

<style scoped>
.post-term-list-widget {
  width: 100%;
}
.post-term-list-widget__rss {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
  font-size: 0.85rem;
  color: var(--color-text-muted, #64748b);
  text-decoration: none;
}
.post-term-list-widget__rss:hover {
  color: var(--vbwd-color-primary, #2563eb);
}
</style>
