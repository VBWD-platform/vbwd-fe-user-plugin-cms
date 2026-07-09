<template>
  <header
    ref="headerElement"
    :class="['cms-super-header', { 'cms-super-header--stuck': isStuck }]"
  >
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

    <!-- Auth link: the same account icon in both states — anonymous links to
         login, signed-in links to the dashboard. The label is the icon's
         accessible name (aria-label + title), never visible text. -->
    <div
      v-if="showAuthLinks"
      class="cms-super-header__auth"
    >
      <a
        class="cms-super-header__auth-link cms-super-header__auth-link--icon"
        :href="authLink.href"
        :aria-label="authLink.label"
        :title="authLink.label"
        :data-test-id="authLink.testId"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle
            cx="12"
            cy="7"
            r="4"
          />
        </svg>
      </a>
    </div>
  </header>

  <!-- Spacer: only present while the header is stuck (fixed, out of flow). Its
       height mirrors the measured header height so page content does not jump
       up by the header's height when it detaches. Purely presentational. -->
  <div
    v-if="isStuck"
    class="cms-super-header__spacer"
    aria-hidden="true"
    data-test-id="super-header-spacer"
    :style="{ height: `${spacerHeightPx}px` }"
  />
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
 *     dashboard_label?, dashboard_path?, stickable?, stickable_offset_px? }
 *
 * When `stickable` is true the header pins itself (position: fixed) to the top
 * of the viewport once the visitor scrolls past `stickable_offset_px`. When
 * false (the default) no scroll listener is attached and behaviour — and the
 * rendered DOM — is exactly as before.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
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
  stickable?: boolean;
  stickable_offset_px?: number;
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
  stickable: false,
  stickable_offset_px: 160,
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

// Both states render the same account icon; only the destination, accessible
// name and test id differ. `login_label` / `dashboard_label` are the icon's
// accessible name (aria-label + title), not visible text.
const authLink = computed(() =>
  authenticated.value
    ? {
        href: config.value.dashboard_path ?? DEFAULTS.dashboard_path,
        label: config.value.dashboard_label ?? DEFAULTS.dashboard_label,
        testId: 'super-header-dashboard-icon',
      }
    : {
        href: config.value.login_path ?? DEFAULTS.login_path,
        label: config.value.login_label ?? DEFAULTS.login_label,
        testId: 'super-header-login-icon',
      });

const navWidget = ref<CmsWidgetData | null>(null);

// --- Stickable header -------------------------------------------------------
// Opt-in: only when `stickable === true` do we attach a scroll listener. The
// header becomes fixed once `window.scrollY` passes the resolved offset, and a
// same-height spacer holds the page layout so content does not jump.
const STICKABLE_DEFAULT_OFFSET_PX = 160;

const stickable = computed(() => config.value.stickable === true);

// Clamp mirrors PostSearch's quicksearch_limit idiom: a non-finite or negative
// value falls back to the default; otherwise floor to a whole, non-negative px.
const stickableOffsetPx = computed(() => {
  const raw = config.value.stickable_offset_px ?? STICKABLE_DEFAULT_OFFSET_PX;
  if (!Number.isFinite(raw) || raw < 0) return STICKABLE_DEFAULT_OFFSET_PX;
  return Math.floor(raw);
});

const headerElement = ref<HTMLElement | null>(null);
const isStuck = ref(false);
const spacerHeightPx = ref(0);
// A boolean guard (not the frame id) throttles the handler: with a synchronous
// scheduler the callback resets it before the id assignment would complete, so
// keying on the id could wedge the throttle. The id is kept only to cancel a
// still-pending frame on unmount.
let scrollFrameScheduled = false;
let pendingScrollFrame: number | null = null;

function evaluateStuckState(): void {
  if (typeof window === 'undefined') return;
  const shouldStick = window.scrollY > stickableOffsetPx.value;
  // Capture the header's current height before it detaches, so the spacer that
  // replaces it in flow is exactly as tall.
  if (shouldStick && headerElement.value) {
    spacerHeightPx.value = headerElement.value.offsetHeight;
  }
  isStuck.value = shouldStick;
}

// rAF-throttled so a burst of scroll events collapses into one layout read per
// frame (no thrash). A single frame is scheduled at a time.
function onScroll(): void {
  if (typeof window === 'undefined' || scrollFrameScheduled) return;
  scrollFrameScheduled = true;
  pendingScrollFrame = window.requestAnimationFrame(() => {
    scrollFrameScheduled = false;
    pendingScrollFrame = null;
    evaluateStuckState();
  });
}

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
  if (stickable.value && typeof window !== 'undefined') {
    window.addEventListener('scroll', onScroll, { passive: true });
  }
});

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return;
  window.removeEventListener('scroll', onScroll);
  if (pendingScrollFrame !== null) {
    window.cancelAnimationFrame(pendingScrollFrame);
    pendingScrollFrame = null;
  }
  scrollFrameScheduled = false;
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
/* Stuck state: the header is fixed to the top of the viewport. Because the
   fixed element leaves `.cms-widget--vue`'s flow, the edge-align block's
   max-width / margin:auto no longer apply — so it re-establishes the page
   column here to stay aligned instead of spanning screen edge to edge.
   z-index 240 sits above ordinary page content yet below the CMS menu chrome
   (overlay 250, mobile drawer 300, burger 400) so the drawer/burger stay on
   top. Colour ALWAYS via theme tokens with a literal only in fallback position. */
.cms-super-header--stuck {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 240;
  max-width: var(--container-max, 1200px);
  margin-left: auto;
  margin-right: auto;
  background: var(--color-surface, var(--color-bg, #fff));
  box-shadow: var(--vbwd-shadow-md, 0 6px 20px rgba(15, 23, 42, 0.12));
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
/* Icon variant (signed-in): a square, transparent affordance so the account
   glyph — which inherits `currentColor` — reads on its own. Colour comes only
   from theme tokens; no new colour declarations are needed here. */
.cms-super-header__auth-link--icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem;
  background: transparent;
  color: var(--color-text, #0f172a);
}
.cms-super-header__auth-link--icon svg {
  display: block;
  width: 1.375rem;
  height: 1.375rem;
}

/* Mobile: the nav's own burger takes over the menu; the search box collapses
   so the logo + burger + auth link stay on one comfortable row. */
@media (max-width: 768px) {
  /* Trim the header's own side gutter on mobile: it is the fourth stacked
     horizontal gutter, so we tighten it (1rem -> 0.75rem) while the theme's
     --edge-inset remains the single outer gutter for the CMS widgets around it.
     Vertical padding is kept; desktop geometry is unchanged. */
  .cms-super-header {
    gap: 0.5rem;
    flex-wrap: wrap;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
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
