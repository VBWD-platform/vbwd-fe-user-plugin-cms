<template>
  <CmsPageTypeBase
    :page="page"
    :layout="layout"
    :header-html="headerHtml"
  />
</template>

<script setup lang="ts">
/**
 * The `post` CMS page type. It renders via CmsPageTypeBase and injects a post
 * header — the title heading with the post's tags directly under it — into the
 * content body (inside the layout's content area, never above the page chrome).
 * No excerpt is injected; the post body keeps its own lead/content.
 */
import { computed } from 'vue';
import type { CmsPageItem, CmsLayout } from '../stores/useCmsStore';
import CmsPageTypeBase from './CmsPageTypeBase.vue';

const props = defineProps<{ page: CmsPageItem; layout: CmsLayout | null }>();

function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// The post header: the title heading + a tag chip strip under it. Built as an
// HTML fragment (not a Vue component) so it lives inside the v-html content
// area; internal tag links are SPA-intercepted by the layout's link handler.
// Only `tag` terms feed the cloud; `category` terms are excluded.
const headerHtml = computed(() => {
  const title = props.page.title ?? props.page.name ?? '';
  const tags = (props.page.terms ?? []).filter((term) => term.term_type === 'tag');

  const titleHtml = title ? `<h1 class="cms-post-title">${escHtml(title)}</h1>` : '';
  const tagsHtml = tags.length
    ? `<div class="cms-post-tags" aria-label="Tags">${tags
        .map(
          (tag) =>
            `<a class="cms-post-tag" href="/tag?tag=${encodeURIComponent(tag.slug)}">${escHtml(tag.name)}</a>`,
        )
        .join('')}</div>`
    : '';

  if (!titleHtml && !tagsHtml) return '';
  return `<header class="cms-post-header">${titleHtml}${tagsHtml}</header>`;
});
</script>
