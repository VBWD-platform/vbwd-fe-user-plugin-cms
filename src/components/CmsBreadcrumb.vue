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

const crumbs = computed<Crumb[]>(() => {
  const parts = route.path.replace(/^\//, '').split('/').filter(Boolean);

  // Flat URL (single segment) — use CMS page metadata for category + title
  if (parts.length === 1) {
    const page = cmsStore.currentPage;
    if (page) {
      const result: Crumb[] = [];
      const category = page.category_id
        ? cmsStore.categories.find((c) => c.id === page.category_id)
        : null;
      if (category) {
        result.push({ label: category.name, to: '/' + category.slug, current: false });
      }
      result.push({ label: page.name, to: route.path, current: true });
      return result;
    }
  }

  // Multi-segment URL — build from path parts
  const showCategory = cfg.value.show_category !== false; // default true
  const categoryLabel = (cfg.value.category_label as string | undefined) ?? '';
  const categorySlug = (cfg.value.category_slug as string | undefined) ?? '';

  return parts
    .map((part, idx): Crumb | null => {
      if (idx === 0) {
        if (!showCategory) return null;
        return {
          label: categoryLabel || slugToLabel(part),
          to: categorySlug || '/' + part,
          current: parts.length === 1,
        };
      }
      return {
        label: slugToLabel(part),
        to: '/' + parts.slice(0, idx + 1).join('/'),
        current: idx === parts.length - 1,
      };
    })
    .filter((c): c is Crumb => c !== null);
});
</script>

<style>
.cms-breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 13px;
  color: #6b7280;
  padding: 8px 0 16px;
}
.cms-breadcrumb a,
.cms-breadcrumb__link {
  color: #3498db;
  text-decoration: none;
}
.cms-breadcrumb a:hover,
.cms-breadcrumb__link:hover {
  text-decoration: underline;
}
.cms-breadcrumb__separator {
  color: #9ca3af;
  user-select: none;
}
.cms-breadcrumb__current {
  color: #374151;
  font-weight: 500;
}
</style>
