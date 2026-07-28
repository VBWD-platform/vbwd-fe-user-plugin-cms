<template>
  <div
    ref="cmsLayoutEl"
    class="cms-layout"
    :class="`cms-layout--${layout.slug}`"
    :style="contentPalette"
  >
    <template
      v-for="area in layout.areas"
      :key="area.name"
    >
      <!-- Content area: render named content block or fallback to page content -->
      <main
        v-if="area.type === 'content'"
        class="cms-area cms-area--content"
        :class="`cms-area--${area.name}`"
      >
        <div class="container">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            ref="contentAreaEl"
            class="cms-page__body"
            v-html="contentBlockHtml(area.name)"
          />
        </div>
      </main>

      <!-- Widget area -->
      <div
        v-else-if="widgetFor(area.name)"
        :class="`cms-area cms-area--${area.type}`"
      >
        <div class="container">
          <CmsWidgetRenderer :widget="widgetFor(area.name)!" />
        </div>
      </div>

      <!-- Declared area with no widget assignment: skip silently -->
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue';
import type {
  CmsLayout,
  CmsWidgetData,
  CmsPageWidgetAssignment,
  CmsPageWidgetOverride,
} from '../stores/useCmsStore';
import CmsWidgetRenderer from './CmsWidgetRenderer.vue';
import { useCmsSpaLinks } from '../composables/useCmsSpaLinks';
import { useCmsLinkPrefetch } from '../composables/useCmsLinkPrefetch';
import { useCmsContentPalette } from '../composables/useCmsContentPalette';

// Root of the whole layout (widgets + main content). Local CMS links anywhere
// inside become instant: SPA-navigated on click, prefetched when visible.
const cmsLayoutEl = ref<HTMLElement | null>(null);
useCmsSpaLinks(cmsLayoutEl);
useCmsLinkPrefetch(cmsLayoutEl);

// Re-assert the CMS theme's own `--color-*` palette on this wrapper so the
// `.vbwd-page` content subtree resolves theme tokens (e.g. --color-border)
// from the CMS style rather than inheriting the theme-switcher's `<html>`
// inline default. Theme-aware (carries whatever the resolved style declares).
const contentPalette = useCmsContentPalette();

const props = defineProps<{
  layout: CmsLayout;
  contentHtml: string;
  contentBlocks?: Record<string, { content_html?: string; source_css?: string | null }>;
  pageAssignments?: CmsPageWidgetAssignment[];
}>();

/**
 * Get HTML for a named content area.
 * 1. Check named content blocks (multi-block pages)
 * 2. Fall back to page's main contentHtml (single-block backward compat)
 */
function contentBlockHtml(areaName: string): string {
  const block = props.contentBlocks?.[areaName];
  if (block?.content_html) return block.content_html;
  // Fallback: if this is the only content area or named "content", use main contentHtml
  return props.contentHtml || '';
}

const contentAreaEl = ref<HTMLElement | HTMLElement[] | null>(null);

function runScripts(container: HTMLElement) {
  container.querySelectorAll('script').forEach(old => {
    const s = document.createElement('script');
    if (old.src) {
      Array.from(old.attributes).forEach(a => s.setAttribute(a.name, a.value));
    } else {
      s.textContent = old.textContent;
    }
    old.replaceWith(s);
  });
}

function getContentEl(): HTMLElement | null {
  const v = Array.isArray(contentAreaEl.value) ? contentAreaEl.value[0] : contentAreaEl.value;
  return v instanceof HTMLElement ? v : null;
}

onMounted(async () => {
  await nextTick();
  const el = getContentEl();
  if (el) runScripts(el);
});

watch(() => props.contentHtml, async () => {
  await nextTick();
  const el = getContentEl();
  if (el) runScripts(el);
});

/**
 * Encode plain HTML the same way the admin HTML editor + renderer do: the
 * renderer decodes content_json.content with `decodeURIComponent(escape(atob))`,
 * so we pair it with `btoa(unescape(encodeURIComponent(html)))`.
 */
function encodeWidgetHtml(html: string): string {
  return btoa(unescape(encodeURIComponent(html)));
}

/**
 * Return a NEW widget with the per-page override applied per widget_type. Only
 * the keys relevant to the type are honoured; an absent/falsy override (or an
 * unknown type) returns the widget unchanged. The layout-level path never calls
 * this, so layout assignments are unaffected.
 */
function applyPageOverride(
  widget: CmsWidgetData,
  override: CmsPageWidgetOverride | null | undefined,
): CmsWidgetData {
  if (!override) return widget;

  if (widget.widget_type === 'vue-component') {
    const merged: CmsWidgetData = {
      ...widget,
      config: { ...(widget.config ?? {}), ...(override.config ?? {}) },
    };
    if (typeof override.source_css === 'string') merged.source_css = override.source_css;
    return merged;
  }

  if (widget.widget_type === 'html') {
    const merged: CmsWidgetData = { ...widget };
    if (typeof override.content_html === 'string') {
      merged.content_json = {
        ...(widget.content_json ?? {}),
        content: encodeWidgetHtml(override.content_html),
      };
    }
    if (typeof override.source_css === 'string') merged.source_css = override.source_css;
    return merged;
  }

  if (widget.widget_type === 'menu') {
    const merged: CmsWidgetData = { ...widget };
    if (Array.isArray(override.menu_items)) merged.menu_items = override.menu_items;
    if (typeof override.source_css === 'string') merged.source_css = override.source_css;
    return merged;
  }

  return widget;
}

function widgetFor(areaName: string): CmsWidgetData | undefined {
  // Page-level assignments override layout-level for the same area. A page
  // assignment may also carry its OWN per-page override, applied per widget
  // type for this page only (the layout-level path below is unaffected).
  const pageAssignment = props.pageAssignments?.find(a => a.area_name === areaName);
  if (pageAssignment?.widget) {
    return applyPageOverride(pageAssignment.widget as CmsWidgetData, pageAssignment.config_override);
  }
  const layoutAssignment = props.layout.assignments?.find(a => a.area_name === areaName);
  return layoutAssignment?.widget as CmsWidgetData | undefined;
}
</script>

<style scoped>
.cms-layout { width: 100%; }
.cms-area { width: 100%; }
.cms-area--content { padding: 3rem 0; }
/* Theme styles set --container-max (1100px / 1200px / 100%). Use the var
 * so themes can widen or narrow; fall back to 1200px if no theme active. */
.container { max-width: var(--container-max, 1200px); margin: 0 auto; padding: 0 1.5rem; }
/* Mobile: collapse this container gutter so the theme's --edge-inset is the
 * SINGLE outer gutter for CMS widgets (see CmsPage.vue for the full three-gutter
 * story). We zero ONLY the horizontal padding; max-width and `margin: 0 auto`
 * stay. Body copy still keeps its readable 1.5rem because the theme's edge-align
 * block targets `.cms-area--content .container` with `!important`, which always
 * beats this non-important rule regardless of specificity. Desktop unchanged. */
@media (max-width: 768px) {
  .container { padding-left: 0; padding-right: 0; }
}
.cms-page__body :deep(img) { max-width: 100%; height: auto; }
.cms-page__body :deep(pre) { background: var(--color-surface-soft, var(--color-surface, #f5f5f5)); color: var(--color-text, inherit); padding: 1rem; border-radius: 4px; overflow-x: auto; }
.cms-page__body :deep(blockquote) { border-left: 4px solid var(--color-border, #ddd); margin: 0; padding-left: 1rem; opacity: 0.8; }
</style>
