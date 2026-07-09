<template>
  <header class="cms-super-header">
    <!-- Logo: an image when configured, otherwise the plain logo text. -->
    <a
      class="cms-super-header__logo"
      :href="logoLink"
    >
      <img
        v-if="logoImageUrl"
        class="cms-super-header__logo-img"
        :src="logoImageUrl"
        :alt="logoText"
      >
      <span
        v-else
        class="cms-super-header__logo-text"
      >{{ logoText }}</span>
    </a>

    <!-- Nav: the referenced widget, rendered through the shared widget
         renderer so the existing menu + burger-drawer behaviour is reused.
         Empty until (and unless) the fetch resolves to a usable widget. -->
    <div class="cms-super-header__nav">
      <CmsWidgetRenderer
        v-if="navWidget"
        :widget="navWidget"
      />
    </div>

    <!-- Search: reuses the standalone PostSearch box (quicksearch + URL sync). -->
    <div
      v-if="showSearch"
      class="cms-super-header__search"
    >
      <PostSearch :config="searchConfig" />
    </div>

    <!-- Auth link: login when anonymous, dashboard when signed in. -->
    <div
      v-if="showAuthLinks"
      class="cms-super-header__auth"
    >
      <a
        class="cms-super-header__auth-link"
        :href="authLink.href"
      >{{ authLink.label }}</a>
    </div>
  </header>
</template>

<script setup lang="ts">
/**
 * SuperHeader — a configurable, self-contained site header widget. Registered
 * in the cms `vueComponentRegistry` as `SuperHeader`; an admin drops it onto a
 * layout header area as a `vue-component` widget.
 *
 * Left-to-right it composes existing pieces rather than reimplementing them:
 *   - a logo (image or text) linking to `logo_link`,
 *   - a nav pulled from another widget by slug and rendered through the shared
 *     `CmsWidgetRenderer` (so the menu + burger drawer are reused verbatim),
 *   - the standalone `PostSearch` box (search + quicksearch), and
 *   - a login/dashboard link driven by the host `isAuthenticated()`.
 *
 * Config (from the widget's `config`, all optional — defaults applied here):
 *   { logo_image_url?, logo_text?, logo_link?, nav_widget_slug?, show_search?,
 *     search_placeholder?, search_target_path?, search_scope?, quicksearch?,
 *     quicksearch_limit?, show_auth_links?, login_label?, login_path?,
 *     dashboard_label?, dashboard_path? }
 */
import { computed, onMounted, ref } from 'vue';
import { api, isAuthenticated } from '@/api';
import type { CmsWidgetData } from '../stores/useCmsStore';
import type { SearchScope } from '../utils/searchScope';
import CmsWidgetRenderer from './CmsWidgetRenderer.vue';
import PostSearch from './PostSearch.vue';

interface SuperHeaderConfig {
  logo_image_url?: string;
  logo_text?: string;
  logo_link?: string;
  nav_widget_slug?: string;
  show_search?: boolean;
  search_placeholder?: string;
  search_target_path?: string;
  search_scope?: SearchScope;
  quicksearch?: boolean;
  quicksearch_limit?: number;
  show_auth_links?: boolean;
  login_label?: string;
  login_path?: string;
  dashboard_label?: string;
  dashboard_path?: string;
}

const props = defineProps<{ config?: SuperHeaderConfig | null }>();

const DEFAULTS = {
  logo_image_url: '',
  logo_text: 'VBWD',
  logo_link: '/',
  nav_widget_slug: 'header-nav',
  show_search: true,
  search_placeholder: 'Search…',
  search_target_path: '/search',
  search_scope: 'both' as SearchScope,
  quicksearch: true,
  quicksearch_limit: 6,
  show_auth_links: true,
  login_label: 'Login',
  login_path: '/login',
  dashboard_label: 'Dashboard',
  dashboard_path: '/dashboard',
} as const;

// The name this widget is registered under — used to break a nav→SuperHeader
// recursion loop (an admin could point `nav_widget_slug` back at a SuperHeader).
const SELF_COMPONENT_NAME = 'SuperHeader';

const config = computed<SuperHeaderConfig>(() => props.config ?? {});

const logoImageUrl = computed(() => config.value.logo_image_url ?? DEFAULTS.logo_image_url);
const logoText = computed(() => config.value.logo_text ?? DEFAULTS.logo_text);
const logoLink = computed(() => config.value.logo_link ?? DEFAULTS.logo_link);
const navWidgetSlug = computed(() => config.value.nav_widget_slug ?? DEFAULTS.nav_widget_slug);

// Boolean toggles are opt-out: anything but an explicit `false` keeps the
// section visible, matching the widget's "on by default" config contract.
const showSearch = computed(() => config.value.show_search !== false);
const showAuthLinks = computed(() => config.value.show_auth_links !== false);

const searchConfig = computed(() => ({
  placeholder: config.value.search_placeholder ?? DEFAULTS.search_placeholder,
  target_path: config.value.search_target_path ?? DEFAULTS.search_target_path,
  scope: config.value.search_scope ?? DEFAULTS.search_scope,
  quicksearch: config.value.quicksearch ?? DEFAULTS.quicksearch,
  quicksearch_limit: config.value.quicksearch_limit ?? DEFAULTS.quicksearch_limit,
}));

// Resolved on mount so tests can control it and so it re-reads the token after
// client-side hydration (the SSR/prerender pass has no session).
const authenticated = ref(false);
const authLink = computed(() =>
  authenticated.value
    ? {
        href: config.value.dashboard_path ?? DEFAULTS.dashboard_path,
        label: config.value.dashboard_label ?? DEFAULTS.dashboard_label,
      }
    : {
        href: config.value.login_path ?? DEFAULTS.login_path,
        label: config.value.login_label ?? DEFAULTS.login_label,
      },
);

const navWidget = ref<CmsWidgetData | null>(null);

function isSuperHeaderWidget(widget: CmsWidgetData): boolean {
  if (widget.widget_type !== 'vue-component') return false;
  const contentJson = widget.content_json as { component?: string } | null;
  const widgetConfig = widget.config as { component_name?: string } | null;
  const componentName = contentJson?.component ?? widgetConfig?.component_name;
  return componentName === SELF_COMPONENT_NAME;
}

async function loadNavWidget(): Promise<void> {
  const slug = navWidgetSlug.value;
  if (!slug) return;
  try {
    const widget = await api.get<CmsWidgetData>(`/cms/widgets/by-slug/${slug}`);
    if (!widget || isSuperHeaderWidget(widget)) return;
    navWidget.value = widget;
  } catch (error) {
    // A missing / failed nav widget renders nothing — no error banner, only a
    // low-key trace (matching the store/composable idiom) so the header still
    // paints its logo, search and auth link.
    console.warn('[CMS] SuperHeader nav widget fetch failed', error);
  }
}

onMounted(() => {
  authenticated.value = isAuthenticated();
  void loadNavWidget();
});
</script>

<style>
/* Non-scoped so the flex bar's structure composes with the injected widget
   source_css / theme tokens. Colour ALWAYS via theme tokens with fallbacks;
   this block owns geometry only. */
.cms-super-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  padding: 0.5rem 1rem;
  box-sizing: border-box;
}
.cms-super-header__logo {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  text-decoration: none;
  font-weight: 700;
  font-size: 1.15rem;
  color: var(--color-text, #0f172a);
}
.cms-super-header__logo-img {
  display: block;
  max-height: 2.25rem;
  width: auto;
}
.cms-super-header__nav {
  display: flex;
  align-items: center;
  min-width: 0;
}
.cms-super-header__search {
  margin-left: auto;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 22rem;
}
.cms-super-header__auth {
  flex-shrink: 0;
}
.cms-super-header__auth-link {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: var(--vbwd-input-radius, 6px);
  text-decoration: none;
  font-weight: 600;
  color: var(--color-primary-contrast, #fff);
  background: var(--color-primary, #2563eb);
}
.cms-super-header__auth-link:hover {
  opacity: 0.9;
}

/* Mobile: the nav's own burger takes over the menu; the search box collapses
   so the logo + burger + auth link stay on one comfortable row. */
@media (max-width: 768px) {
  .cms-super-header {
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .cms-super-header__search {
    order: 3;
    flex-basis: 100%;
    max-width: none;
    margin-left: 0;
  }
  .cms-super-header__nav {
    margin-left: auto;
  }
}
</style>
