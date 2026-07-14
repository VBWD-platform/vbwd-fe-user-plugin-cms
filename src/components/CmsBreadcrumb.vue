<template>
  <VbwdBreadcrumb
    :separator="cfg.separator"
    :css="cfg.css"
    :max-label-length="cfg.max_label_length"
  />
</template>

<script setup lang="ts">
/**
 * CmsBreadcrumb — a thin adapter widget.
 *
 * Trail construction now lives in the CMS breadcrumb PROVIDER (registered in the
 * plugin's `install()` → `buildCmsBreadcrumbTrail`). This widget simply renders
 * the core `VbwdBreadcrumb`, which asks every registered provider for a trail
 * (first non-null wins) and renders it. All the widget still owns is mapping its
 * own `config` — `separator` / `css` / `max_label_length` — onto the core props,
 * so existing layouts that placed the `CmsBreadcrumb` widget keep working.
 */
import { computed } from 'vue';
import { VbwdBreadcrumb } from 'vbwd-view-component';

interface BreadcrumbConfig {
  separator?: string;
  max_label_length?: number;
  css?: string;
  [key: string]: unknown;
}

interface Props {
  config?: BreadcrumbConfig | null;
}

const props = defineProps<Props>();

const cfg = computed<BreadcrumbConfig>(() => props.config ?? {});
</script>
