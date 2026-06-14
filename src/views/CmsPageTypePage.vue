<template>
  <CmsPageTypeBase
    :page="page"
    :layout="layout"
  />
</template>

<script setup lang="ts">
/**
 * The generic CMS page type. A thin default that renders the shared scaffolding
 * with no header — pages hand-author their own heading inside content_html
 * (e.g. a theme-showcase page), so they get no auto header (parity with the
 * old non-post rendering path).
 */
import type { CmsPageItem, CmsLayout } from '../stores/useCmsStore';
import CmsPageTypeBase from './CmsPageTypeBase.vue';

defineProps<{ page: CmsPageItem; layout: CmsLayout | null }>();
</script>
