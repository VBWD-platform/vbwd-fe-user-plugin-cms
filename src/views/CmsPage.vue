<template>
  <div class="cms-page">
    <div
      v-if="store.loading"
      class="cms-page__loading"
    >
      {{ $t('cms.loading') }}
    </div>

    <div
      v-else-if="store.accessDenied"
      class="cms-page__access-denied"
    >
      <h2>{{ isAuthenticated ? $t('cms.accessDenied', 'Access Denied') : $t('cms.loginRequired', 'Login Required') }}</h2>
      <p>{{ isAuthenticated ? $t('cms.upgradePlan', 'Upgrade your plan to access this content.') : $t('cms.loginToView', 'Please log in to view this page.') }}</p>
      <router-link
        v-if="!isAuthenticated"
        to="/login"
        class="cms-page__login-link"
      >
        {{ $t('common.login', 'Log In') }}
      </router-link>
    </div>

    <div
      v-else-if="store.error || !store.currentPage"
      class="cms-page__not-found"
      role="alert"
    >
      <div class="cms-page__not-found-inner">
        <div
          class="cms-page__not-found-code"
          aria-hidden="true"
        >
          404
        </div>
        <h1 class="cms-page__not-found-title">
          {{ $t('cms.notFoundTitle', 'Page not found') }}
        </h1>
        <p class="cms-page__not-found-message">
          {{ $t('cms.notFoundMessage', "The page you’re looking for doesn’t exist, moved, or is temporarily unavailable.") }}
        </p>
        <div class="cms-page__not-found-ctas">
          <router-link
            to="/"
            class="btn btn--accent"
          >
            {{ $t('cms.notFoundHome', 'Back to home') }}
          </router-link>
          <button
            type="button"
            class="btn"
            @click="$router.back()"
          >
            {{ $t('cms.notFoundBack', 'Go back') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Page present: dispatch to the registered type component (default page) -->
    <component
      :is="typeComponent"
      v-else
      :page="store.currentPage"
      :layout="store.currentLayout"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * CMS page dispatcher. Owns the fetch + the loading / access-denied / 404
 * states; when a page is present it resolves the type component from
 * `pageTypeRegistry` by `currentPage.type` (default `page` when absent or
 * unregistered) and renders it. The 404 markup + styles stay here because they
 * render when there is NO page, so no type component applies.
 */
import { computed, watch, onMounted, type Component } from 'vue';
import { useRoute } from 'vue-router';
import { useCmsStore } from '../stores/useCmsStore';
import { isAuthenticated as checkAuth } from '@/api';
import { resolveCmsPageType } from '../registry/pageTypeRegistry';
import CmsPageTypePage from './CmsPageTypePage.vue';

const isAuthenticated = checkAuth();

const props = defineProps<{ slug?: string }>();

const route = useRoute();
const store = useCmsStore();

const effectiveSlug = computed(() => props.slug ?? (route.params.slug as string));

const typeComponent = computed<Component>(() => {
  const type = store.currentPage?.type ?? 'page';
  return resolveCmsPageType(type) ?? resolveCmsPageType('page') ?? CmsPageTypePage;
});

const previewToken = computed(() => route.query.preview_token as string | undefined);

watch(effectiveSlug, (slug) => {
  store.fetchPage(slug, previewToken.value);
});

onMounted(() => {
  store.fetchPage(effectiveSlug.value, previewToken.value);
});
</script>

<style scoped>
/* Theme styles own the page width via --container-max / their own .container
 * rule. Keep only a full-width fallback here so the page stays edge-to-edge
 * by default and the theme can tighten it down. The old 800px cap made every
 * page look like a narrow blog post regardless of theme. */
.cms-page { margin: 0 auto; padding: 0.5rem 1rem; }
.cms-page__loading { color: var(--color-text-muted, #888); padding: 2rem 0; text-align: center; }

/* 404 — responsive, theme-aware. Uses --color-accent / --color-heading
 * / --color-text-muted from the active theme so it matches the site. */
.cms-page__not-found {
  min-height: calc(100vh - 220px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(2rem, 6vw, 4rem) 1.25rem;
  box-sizing: border-box;
}
.cms-page__not-found-inner {
  width: 100%;
  max-width: 640px;
  text-align: center;
}
.cms-page__not-found-code {
  font-size: clamp(5rem, 22vw, 11rem);
  font-weight: 900;
  line-height: 0.9;
  letter-spacing: -0.04em;
  background: linear-gradient(135deg, var(--color-accent, #2563eb), var(--color-accent-dark, #1d4ed8));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-bottom: 0.5rem;
  user-select: none;
}
.cms-page__not-found-title {
  font-size: clamp(1.4rem, 3.5vw, 2rem);
  color: var(--color-heading, #0f172a);
  margin: 0 0 0.75rem;
}
.cms-page__not-found-message {
  color: var(--color-text-muted, #64748b);
  font-size: clamp(1rem, 1.6vw, 1.125rem);
  line-height: 1.55;
  margin: 0 auto 2rem;
  max-width: 42ch;
}
.cms-page__not-found-ctas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
}
/* Self-contained button styles for the 404 view — theme's .btn CSS is only
 * injected when a page loads successfully; on 404 there is no currentPage,
 * so we ship a themed-but-self-contained set of button styles here. */
.cms-page__not-found-ctas :deep(.btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.6rem;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1.2;
  cursor: pointer;
  border: 2px solid var(--color-border, #e2e8f0);
  background: var(--color-surface, #ffffff);
  color: var(--color-heading, #0f172a);
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s, transform 0.05s;
}
.cms-page__not-found-ctas :deep(.btn:hover) {
  background: var(--color-surface-soft, #f1f5f9);
  border-color: var(--color-text-muted, #94a3b8);
}
.cms-page__not-found-ctas :deep(.btn:active) { transform: translateY(1px); }
.cms-page__not-found-ctas :deep(.btn--accent) {
  background: var(--color-accent, #2563eb);
  color: var(--color-accent-fg, #ffffff);
  border-color: var(--color-accent, #2563eb);
}
.cms-page__not-found-ctas :deep(.btn--accent:hover) {
  background: var(--color-accent-dark, #1d4ed8);
  border-color: var(--color-accent-dark, #1d4ed8);
  color: var(--color-accent-fg, #ffffff);
}
@media (max-width: 480px) {
  .cms-page__not-found-ctas { flex-direction: column; width: 100%; max-width: 320px; margin: 0 auto; }
  .cms-page__not-found-ctas :deep(.btn) { width: 100%; }
}
</style>
