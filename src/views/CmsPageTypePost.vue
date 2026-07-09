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
 * header into the content body (inside the layout's content area, never above
 * the page chrome).
 *
 * By default it emits a magazine-style hero: a featured image (or a
 * theme-token gradient band when there is no image) with the post title and
 * excerpt overlaid on a blurred contrast layer, with the tag chips under the
 * heading. A per-post flag (`type_data.show_featured_hero === false`) turns
 * the hero off and falls back to the plain title-only header. The flag is
 * absent-by-default, so the hero is ON unless explicitly disabled.
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

// Escape a value for use inside an HTML attribute (mirrors the base scaffold's
// helper). Strips the CSS-url-breakout characters first so a featured image
// URL can be dropped into an inline `background-image: url("...")` safely.
function escAttr(value: string): string {
  return value
    .replace(/["'()\\]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;');
}

// Only `tag` terms feed the chip strip; `category` terms are excluded.
const tagChipsHtml = computed(() => {
  const tags = (props.page.terms ?? []).filter((term) => term.term_type === 'tag');
  if (!tags.length) return '';
  return `<div class="cms-post-tags" aria-label="Tags">${tags
    .map(
      (tag) =>
        // Real tag-archive link at the fixed `/tag/<slug>` prefix (resolved via
        // the catch-all → term precedence), not the legacy `?tag=` query.
        `<a class="cms-post-tag" href="/tag/${encodeURIComponent(tag.slug)}">${escHtml(tag.name)}</a>`,
    )
    .join('')}</div>`;
});

// Hero is ON unless the post explicitly opted out (absent flag = default ON).
const heroEnabled = computed(
  () => (props.page.type_data as Record<string, unknown> | null | undefined)?.show_featured_hero !== false,
);

// The post header. Built as an HTML fragment (not a Vue component) so it lives
// inside the v-html content area; internal tag links are SPA-intercepted by the
// layout's link handler.
const headerHtml = computed(() => {
  const title = props.page.title ?? props.page.name ?? '';
  const titleHtml = title ? `<h1 class="cms-post-title">${escHtml(title)}</h1>` : '';
  const tagsHtml = tagChipsHtml.value;

  // Hero disabled → the plain, unchanged title-only header (no excerpt, no image).
  if (!heroEnabled.value) {
    if (!titleHtml && !tagsHtml) return '';
    return `<header class="cms-post-header">${titleHtml}${tagsHtml}</header>`;
  }

  // Hero enabled → magazine header with title + excerpt over a blurred contrast
  // layer, tags under the heading. An image backs it when present, else a
  // theme-token gradient band.
  const excerpt = props.page.excerpt ?? '';
  const excerptHtml = excerpt ? `<p class="cms-post-excerpt">${escHtml(excerpt)}</p>` : '';
  const imageUrl = props.page.featured_image_url ?? '';

  if (imageUrl) {
    const bgStyle = `background-image: url(&quot;${escAttr(imageUrl)}&quot;);`;
    return (
      `<header class="cms-post-hero cms-post-hero--image" style="${bgStyle}">` +
      '<div class="cms-post-hero__scrim"></div>' +
      '<div class="cms-post-hero__content">' +
      `<div class="cms-post-hero__contrast">${titleHtml}${excerptHtml}</div>` +
      `${tagsHtml}` +
      '</div>' +
      '</header>'
    );
  }

  return (
    '<header class="cms-post-hero cms-post-hero--gradient">' +
    '<div class="cms-post-hero__content">' +
    `<div class="cms-post-hero__contrast">${titleHtml}${excerptHtml}</div>` +
    `${tagsHtml}` +
    '</div>' +
    '</header>'
  );
});
</script>
