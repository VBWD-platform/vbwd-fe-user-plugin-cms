<template>
  <!-- Layout-based rendering -->
  <template v-if="layout">
    <CmsLayoutRenderer
      :layout="layout"
      :content-html="bodyHtml"
      :content-blocks="pageContentBlocks"
      :page-assignments="pageWidgetAssignments"
    />
  </template>

  <!-- Fallback: simple article rendering (no layout) -->
  <article
    v-else
    class="cms-page__content"
  >
    <h1 class="cms-page__title">
      {{ pageTitle }}
    </h1>
    <!-- eslint-disable vue/no-v-html -->
    <div
      class="cms-page__body"
      v-html="bodyHtml"
    />
    <!-- eslint-enable vue/no-v-html -->
  </article>

  <!-- S77 — generic core tags + custom fields, ALONGSIDE the legacy taxonomy.
       Read straight off the serialized payload via the shared fe-core display
       components (no extra fetch). Shown for both page and post renders. -->
  <div
    v-if="hasTagsOrCustomFields"
    class="cms-page__tags-custom-fields"
    data-testid="page-tags-custom-fields"
  >
    <TagChips
      v-if="page.tags && page.tags.length"
      :tags="page.tags"
    />
    <CustomFieldsDisplay
      v-if="page.custom_fields"
      :custom-fields="page.custom_fields"
      :field-defs="page.custom_field_defs"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Shared scaffolding for every CMS page type. Owns the TipTap-JSON → HTML
 * renderer, the resolved-style application, SEO meta injection and the
 * layout-vs-article render. Concrete page types (page, post, plugin types)
 * compose this and feed it a `page` + `layout`, optionally supplying a
 * `headerHtml` fragment that is prepended INTO the content body (inside the
 * layout's content area — never above the page chrome).
 */
import { computed, watch, onUnmounted } from 'vue';
import { TagChips, CustomFieldsDisplay } from 'vbwd-view-component';
import type { CmsPageItem, CmsLayout } from '../stores/useCmsStore';
import { useCmsStore } from '../stores/useCmsStore';
import CmsLayoutRenderer from '../components/CmsLayoutRenderer.vue';
import { injectSeoMeta } from '../composables/useSeoHandoff';

const props = defineProps<{
  page: CmsPageItem;
  layout: CmsLayout | null;
  /** Optional HTML fragment prepended to the content body (e.g. a post's tags). */
  headerHtml?: string;
}>();

const store = useCmsStore();

// Unified cms_post exposes `title`; legacy cms_page exposed `name`. Prefer
// `title` and fall back to `name` so both shapes render the same heading.
const pageTitle = computed(() => props.page.title ?? props.page.name ?? '');

// Multi-content blocks from page data (keyed by area name).
const pageContentBlocks = computed(() => props.page.content_blocks ?? {});

// S77 — only render the core tags / custom-fields block when there is content.
const hasTagsOrCustomFields = computed(() => {
  const hasTags = Array.isArray(props.page.tags) && props.page.tags.length > 0;
  const fields = props.page.custom_fields;
  const hasFields = !!fields && Object.keys(fields).length > 0;
  return hasTags || hasFields;
});

// Page-level widget assignments (override layout widgets for the same area).
const pageWidgetAssignments = computed(() => {
  const assignments = props.page.page_assignments;
  return assignments && assignments.length > 0 ? assignments : undefined;
});

// ── TipTap JSON → HTML renderer (no external dependency) ─────────────────────

type TNode = { type: string; text?: string; marks?: TMark[]; content?: TNode[]; attrs?: Record<string, unknown> };
type TMark = { type: string; attrs?: Record<string, unknown> };

function renderNode(node: TNode): string {
  if (!node) return '';

  if (node.type === 'text') {
    let text = escHtml(node.text ?? '');
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'bold') text = `<strong>${text}</strong>`;
        else if (mark.type === 'italic') text = `<em>${text}</em>`;
        else if (mark.type === 'underline') text = `<u>${text}</u>`;
        else if (mark.type === 'strike') text = `<s>${text}</s>`;
        else if (mark.type === 'code') text = `<code>${text}</code>`;
        else if (mark.type === 'link') {
          const href = escAttr(String(mark.attrs?.href ?? ''));
          const target = mark.attrs?.target ? ` target="${escAttr(String(mark.attrs.target))}"` : '';
          text = `<a href="${href}"${target}>${text}</a>`;
        }
      }
    }
    return text;
  }

  const children = (node.content ?? []).map(renderNode).join('');

  switch (node.type) {
    case 'doc':         return children;
    case 'paragraph':   return `<p>${children || '&nbsp;'}</p>`;
    case 'heading': {
      const level = Number(node.attrs?.level ?? 2);
      return `<h${level}>${children}</h${level}>`;
    }
    case 'bulletList':  return `<ul>${children}</ul>`;
    case 'orderedList': return `<ol>${children}</ol>`;
    case 'listItem':    return `<li>${children}</li>`;
    case 'blockquote':  return `<blockquote>${children}</blockquote>`;
    case 'codeBlock':   return `<pre><code>${children}</code></pre>`;
    case 'hardBreak':   return '<br>';
    case 'horizontalRule': return '<hr>';
    case 'image': {
      const src = escAttr(String(node.attrs?.src ?? ''));
      const alt = escAttr(String(node.attrs?.alt ?? ''));
      return `<img src="${src}" alt="${alt}" style="max-width:100%">`;
    }
    default:            return children;
  }
}

function escHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str: string) {
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const renderedHtml = computed(() => {
  // Prefer raw content_html (set via HTML tab) so embedded scripts / iframes are preserved
  const raw = props.page.content_html;
  if (raw) return raw;
  const doc = props.page.content_json;
  if (!doc || typeof doc !== 'object') return '';
  return renderNode(doc as TNode);
});

// The body the layout/article actually renders: the page-type's optional header
// fragment (e.g. a post's tag chips) prepended to the rendered content. This is
// injected INTO the content area — it never renders above the page chrome.
const bodyHtml = computed(() => (props.headerHtml ?? '') + renderedHtml.value);

// ── Page style application ─────────────────────────────────────────────────

let styleTag: HTMLStyleElement | null = null;

function applyPageStyle(css: string | null) {
  if (styleTag) { styleTag.remove(); styleTag = null; }
  if (!css) return;
  styleTag = document.createElement('style');
  styleTag.setAttribute('data-cms-page-style', '');
  styleTag.textContent = css;
  document.head.appendChild(styleTag);
}

// The resolved style (explicit style_id, else the admin default) is applied
// first; the page's own source_css (the editor's CSS tab) is layered on top so
// it can override the style. There is no theme-switcher opt-out anymore.
function applyEffectiveStyle() {
  const styleCss = store.currentStyleCss ?? '';
  const pageCss = props.page.source_css ?? '';
  const combined = [styleCss, pageCss].filter(Boolean).join('\n');
  applyPageStyle(combined || null);
}

// ── SEO meta injection ──────────────────────────────────────────────────────
// Update-in-place keyed by `data-seo="ssr"` (see useSeoHandoff) so server-
// emitted prerender tags are replaced rather than duplicated.

watch(
  () => props.page,
  (page) => {
    // The unified cms_post carries `title`; injectSeoMeta keys the document
    // title off `name`, so map it across (legacy pages already set `name`).
    injectSeoMeta({
      ...page,
      name: page.name ?? page.title ?? null,
    });
    applyEffectiveStyle();
  },
  { immediate: true },
);

watch(() => store.currentStyleCss, applyEffectiveStyle);

onUnmounted(() => {
  // SEO tags are keyed by `data-seo="ssr"` and updated in place by the next
  // page, so they are intentionally NOT removed here. Only the page-scoped
  // style tag is cleaned up.
  if (styleTag) { styleTag.remove(); styleTag = null; }
});
</script>

<style scoped>
.cms-page__title { margin-bottom: 1.5rem; }
.cms-page__body :deep(img) { max-width: 100%; height: auto; }
.cms-page__body :deep(pre) { background: var(--color-surface-soft, var(--color-code-bg, #f5f5f5)); color: var(--color-text, inherit); padding: 1rem; border-radius: 4px; overflow-x: auto; }
.cms-page__body :deep(blockquote) { border-left: 4px solid var(--color-border, #ddd); margin: 0; padding-left: 1rem; color: var(--color-text-muted, #666); }
</style>

<!-- Non-scoped: content is injected via v-html (scoped styles never reach it),
     so constrain content images globally — a natural-size image must never
     overflow / stretch the layout. Applies to both the layout and fallback
     render paths (both wrap content in .cms-page__body). -->
<style>
.cms-page__body img { max-width: 100%; height: auto; }

/* Post header (title + tag chips) — injected into the content body via
 * headerHtml (so it lives inside the v-html content area). Non-scoped because
 * scoped styles never reach v-html content. */
.cms-post-header { margin: 0 0 1.25rem; }
.cms-post-title { margin: 0 0 0.75rem; }
.cms-post-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0; }
.cms-post-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.85rem;
  line-height: 1.3;
  border: 1px solid var(--color-border, #e2e8f0);
  background: var(--color-surface-soft, var(--color-surface, #f1f5f9));
  color: var(--color-text-muted, #64748b);
  text-decoration: none;
}
.cms-post-tag:hover { color: var(--vbwd-color-primary, #2563eb); border-color: var(--vbwd-color-primary, #2563eb); }
</style>
