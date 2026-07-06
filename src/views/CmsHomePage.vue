<template>
  <CmsPage :slug="homeSlug" />
</template>

<script setup lang="ts">
/**
 * The canonical homepage (`/`). Renders the home CMS post IN PLACE at `/`
 * (canonical self) by delegating to the shared CmsPage dispatcher with the
 * resolved home slug — NO client redirect to a `/home` slug (S120).
 *
 * The slug is resolved from the public app-config (single source of truth,
 * loaded once at boot by App.vue), falling back to the baked `index` default.
 * That fallback is what makes the homepage resilient: a cold SPA shell with no
 * `#__POST__` handoff and a failing routing-rules fetch still renders the home
 * post via `GET /cms/posts/index`, never the NotFound/404 block.
 *
 * Authenticated visitors never reach this component: the host router's
 * navigation guard redirects `/` → `/dashboard` before it mounts.
 */
import { computed } from 'vue';
import { useAppConfigStore } from '@/stores/appConfig';
import CmsPage from './CmsPage.vue';

const appConfig = useAppConfigStore();
const homeSlug = computed(() => appConfig.homeSlug);
</script>
