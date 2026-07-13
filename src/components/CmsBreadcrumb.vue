<template>
  <nav
    class="cms-breadcrumb"
    aria-label="breadcrumb"
  >
    <component
      :is="'style'"
      v-if="css"
    >
      {{ css }}
    </component>

    <router-link
      :to="cfg.root_slug || '/'"
      class="cms-breadcrumb__link"
    >
      {{ cfg.root_name || 'Home' }}
    </router-link>

    <template
      v-for="(crumb, idx) in crumbs"
      :key="idx"
    >
      <span
        class="cms-breadcrumb__separator"
        aria-hidden="true"
      >{{ cfg.separator || '/' }}</span>
      <router-link
        v-if="!crumb.current"
        :to="crumb.to"
        class="cms-breadcrumb__link"
      >
        {{ truncate(crumb.label) }}
      </router-link>
      <span
        v-else
        class="cms-breadcrumb__current"
      >{{ truncate(crumb.label) }}</span>
    </template>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useCmsStore } from '../stores/useCmsStore';
import { getBreadcrumbLabel } from '../composables/useBreadcrumbLabel';

interface BreadcrumbConfig {
  separator?: string;
  root_name?: string;
  root_slug?: string;
  /** Whether to include the first URL path segment (e.g. "category" / "software") as a crumb */
  show_category?: boolean;
  /** Override label for the first URL segment (defaults to auto-title from slug) */
  category_label?: string;
  /** Override URL the first segment links to (defaults to the actual URL segment path) */
  category_slug?: string;
  max_label_length?: number;
  css?: string;
  [key: string]: unknown;
}

interface Props {
  config?: BreadcrumbConfig | null;
}

const props = defineProps<Props>();
const route = useRoute();
const cmsStore = useCmsStore();

const cfg = computed<BreadcrumbConfig>(() => props.config ?? {});
const css = computed(() => cfg.value.css ?? '');
const maxLen = computed(() => (cfg.value.max_label_length as number | undefined) ?? 60);

function slugToLabel(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncate(label: string): string {
  if (!label) return '';
  return label.length > maxLen.value ? label.slice(0, maxLen.value) + '…' : label;
}

interface Crumb { label: string; to: string; current: boolean }

// Generic seam: a page/widget may override the CURRENT crumb's display label
// for this exact route path (e.g. show a real entity name instead of the
// slug-derived label). No override → default behaviour is unchanged.
function applyCurrentLabelOverride(built: Crumb[]): Crumb[] {
  const overrideLabel = getBreadcrumbLabel(route.path);
  if (overrideLabel) {
    const current = built.find((crumb) => crumb.current);
    if (current) current.label = overrideLabel;
  }
  return built;
}

const crumbs = computed<Crumb[]>(() => {
  const parts = route.path.replace(/^\//, '').split('/').filter(Boolean);
  const page = cmsStore.currentPage;

  // Flat URL (single segment) — use CMS page metadata for category + title
  if (parts.length === 1) {
    if (page) {
      const result: Crumb[] = [];
      const category = page.category_id
        ? cmsStore.categories.find((c) => c.id === page.category_id)
        : null;
      if (category) {
        result.push({ label: category.name, to: '/' + category.slug, current: false });
      }
      result.push({ label: page.title ?? page.name ?? '', to: route.path, current: true });
      return result;
    }
    // Single segment, no store page — original slug-derived current crumb.
    const showCategory = cfg.value.show_category !== false; // default true
    if (!showCategory) return [];
    const categoryLabel = (cfg.value.category_label as string | undefined) ?? '';
    return applyCurrentLabelOverride([
      {
        label: categoryLabel || slugToLabel(parts[0]),
        to: route.path,
        current: true,
      },
    ]);
  }

  // Multi-segment permalink for a POST — build crumbs from the STORE, never by
  // slicing the raw URL. A permalink like `%root%/[%year%/]%category_path%/%slug%`
  // contains segments (`blog`, `2026`) that have NO backing route; only the Home
  // link, the category TERM ARCHIVE and the post itself are navigable.
  const isPost = !!page
    && (page.type === 'post' || (Array.isArray(page.terms) && page.terms.length > 0));
  if (page && isPost) {
    const result: Crumb[] = [];
    const showCategory = cfg.value.show_category !== false; // default true
    if (showCategory) {
      const terms = page.terms ?? [];
      const category = terms.find(
        (term) => term.term_type === 'category' && term.id === page.primary_term_id,
      ) ?? terms.find((term) => term.term_type === 'category');
      if (category && category.archive_url) {
        result.push({
          label: category.name,
          to: '/' + String(category.archive_url).replace(/^\/+/, ''),
          current: false,
        });
      }
    }
    result.push({ label: page.title ?? page.name ?? '', to: route.path, current: true });
    return applyCurrentLabelOverride(result);
  }

  // Multi-segment fallback (no store post data): render ONLY the current crumb
  // (last segment, slug-derived) as a non-link. Intermediate URL prefixes are
  // dropped so no crumb can ever link to a non-resolving 404 URL.
  const lastPart = parts[parts.length - 1];
  return applyCurrentLabelOverride([
    { label: slugToLabel(lastPart), to: route.path, current: true },
  ]);
});
</script>

<style>
/* S109: theme-aware via --vbwd-* roles; light fallbacks == original values so
   the default theme is visually unchanged. */
.cms-breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 13px;
  color: var(--vbwd-text-muted, #6b7280);
  padding: 8px 0 16px;
}
.cms-breadcrumb a,
.cms-breadcrumb__link {
  color: var(--vbwd-color-primary, #3498db);
  text-decoration: none;
}
.cms-breadcrumb a:hover,
.cms-breadcrumb__link:hover {
  text-decoration: underline;
}
.cms-breadcrumb__separator {
  color: var(--vbwd-text-muted, #9ca3af);
  user-select: none;
}
.cms-breadcrumb__current {
  color: var(--vbwd-text-body, #374151);
  font-weight: 500;
}
</style>
