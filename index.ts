import { defineAsyncComponent } from 'vue';
import type { IPlugin, IPlatformSDK } from 'vbwd-view-component';
import { registerCmsVueComponent } from './src/registry/vueComponentRegistry';
import { registerPostContentType } from './src/registry/contentTypeRegistry';
import {
  registerCmsPageType,
  resolveCmsPageType,
} from './src/registry/pageTypeRegistry';
import RichTextBlock from './src/components/RichTextBlock.vue';
import { createCmsMiddlewareRoutingGuard } from './src/routing/middlewareRoutingGuard';
import { api as hostApi } from '@/api';
import en from './locales/en.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import ru from './locales/ru.json';
import th from './locales/th.json';
import zh from './locales/zh.json';

export const cmsPlugin: IPlugin = {
  name: 'cms',
  version: '1.0.0',
  description: 'CMS Pages — public-facing page and category browsing',
  dependencies: ['landing1'],
  _active: false,

  install(sdk: IPlatformSDK) {
    // Register built-in CMS vue-component widgets. Async dynamic imports that
    // populate the (non-reactive) vue-component registry; an admin drops any of
    // these onto a cms page/layout as a `vue-component` widget and the widget
    // renderer resolves it by name.
    import('./src/components/CmsBreadcrumb.vue').then((m) => {
      registerCmsVueComponent('CmsBreadcrumb', m.default);
    });
    import('./src/components/NativePricingPlans.vue').then((m) => {
      registerCmsVueComponent('NativePricingPlans', m.default);
    });
    import('./src/components/ContactForm.vue').then((m) => {
      registerCmsVueComponent('ContactForm', m.default);
    });
    // S47.3 — the "Category" (term-list) widget. Registered under both names
    // so an admin can drop a `vue-component` widget (content_json.component =
    // "Category" | "PostTermList") onto any cms page to list a term's posts.
    import('./src/components/PostTermListWidget.vue').then((m) => {
      registerCmsVueComponent('Category', m.default);
      registerCmsVueComponent('PostTermList', m.default);
    });
    // S47.4 — the decoupled Search trio companions. `Search` (box) URL-syncs
    // `?q=`; `SearchResults` reads it and renders matches through PostList.
    // They compose on one page or across pages via the URL param.
    import('./src/components/PostSearch.vue').then((m) => {
      registerCmsVueComponent('Search', m.default);
    });
    import('./src/components/PostSearchResults.vue').then((m) => {
      registerCmsVueComponent('SearchResults', m.default);
    });
    // URL-driven tag-archive widget. `CmsTagCloud` chips link to
    // `/tag?tag=<slug>`; `TagArchive` reads `?tag=` and lists that tag's posts
    // through the same usePosts.byTerm + PostList path as the Category widget.
    import('./src/components/TagArchive.vue').then((m) => {
      registerCmsVueComponent('TagArchive', m.default);
    });
    // Public add-on catalogue widget. Fetches GET /api/v1/addons/ and renders a
    // card per add-on with the price rendered through the shared PriceDisplay
    // (fed by the S85 price_info block). An admin drops it onto any cms
    // page/layout vue area as a `vue-component` widget (content_json.component =
    // "AddonCatalog").
    import('./src/components/AddonCatalog.vue').then((m) => {
      registerCmsVueComponent('AddonCatalog', m.default);
    });
    // Custom Code widget — an admin drops it onto any page or layout area and
    // pastes a raw HTML/JS block (e.g. the Google gtag analytics snippet) into
    // its config.code; the widget builds + executes the <script> tags safely
    // when rendered through CmsLayoutRenderer → CmsWidgetRenderer.
    import('./src/components/CustomCodeWidget.vue').then((m) => {
      registerCmsVueComponent('CustomCode', m.default);
    });
    // S87 — GDPR/DSGVO Cookie Consent widget. An admin drops it into a layout
    // area; the component Teleports a full-screen consent overlay to <body> on
    // first visit and drives Google Consent Mode v2 (placement = mount trigger).
    import('./src/components/CookieConsent.vue').then((m) => {
      registerCmsVueComponent('CookieConsent', m.default);
    });

    // S47.3 — built-in `richtext` content-type renderer (placement: inline).
    // A post with no blocks renders its content_html as one implicit richtext
    // block; extension plugins register further types via the same registry.
    registerPostContentType('richtext', RichTextBlock, { placement: 'inline' });

    // Built-in CMS page types. CmsPage.vue dispatches a post's `type` to the
    // registered component (default `page`). Extension plugins register their
    // own type (e.g. `video` → CmsPageTypeVideo) via the re-exported seam.
    registerCmsPageType('page', defineAsyncComponent(() => import('./src/views/CmsPageTypePage.vue')));
    registerCmsPageType('post', defineAsyncComponent(() => import('./src/views/CmsPageTypePost.vue')));

    // S91 — chrome-light embed routes for the mobile WebView. Registered
    // BEFORE the `/:slug(.+)` catch-all so the literal `/cms/embed/...` paths
    // win and are never swallowed by the single-param page catch-all. The more
    // specific detail route (`.../post/:slug`) is registered before the archive
    // route so `/cms/embed/<type>/post/<slug>` resolves to the detail
    // dispatcher, not the archive's `:category`. `meta.embed` makes the host
    // App.vue render a bare <router-view /> (no global nav/burger/footer).
    sdk.addRoute({
      path: '/cms/embed/:type/post/:slug',
      name: 'cms-embed-detail',
      component: () => import('./src/views/CmsPage.vue'),
      meta: { requiresAuth: false, embed: true },
    });

    sdk.addRoute({
      path: '/cms/embed/:type/:category',
      name: 'cms-embed-archive',
      component: () => import('./src/views/CmsEmbedArchive.vue'),
      meta: { requiresAuth: false, embed: true },
    });

    sdk.addRoute({
      path: '/:slug(.+)',
      name: 'cms-page',
      component: () => import('./src/views/CmsPage.vue'),
      meta: { requiresAuth: false, cmsLayout: true },
    });

    sdk.addRoute({
      path: '/pages',
      name: 'cms-page-index',
      component: () => import('./src/views/CmsPageIndex.vue'),
      meta: { requiresAuth: false, cmsLayout: true },
    });

    sdk.addTranslations('en', en);
    sdk.addTranslations('de', de);
    sdk.addTranslations('es', es);
    sdk.addTranslations('fr', fr);
    sdk.addTranslations('ja', ja);
    sdk.addTranslations('ru', ru);
    sdk.addTranslations('th', th);
    sdk.addTranslations('zh', zh);

    // Register a router beforeEach guard that evaluates middleware-layer
    // CMS routing rules client-side. Without this, rules saved via the
    // admin (path_prefix, default, language, cookie) would never fire
    // for SPA navigations — nginx serves index.html for any non-/api/
    // path, so the backend middleware never sees them. Scoped to the
    // home + CMS catch-all routes inside the guard itself, so it cannot
    // hijack /login, /dashboard, etc.
    sdk.addRouterGuard(createCmsMiddlewareRoutingGuard(hostApi));
  },

  activate() { this._active = true; },
  deactivate() { this._active = false; },
};

// Public SDK seam: external fe-user plugins import these from the cms plugin
// entry to register their own page types (e.g. a video plugin →
// CmsPageTypeVideo) without touching cms/core.
export { registerCmsPageType, resolveCmsPageType };
