import type { IPlugin, IPlatformSDK } from 'vbwd-view-component';
import { registerCmsVueComponent } from './src/registry/vueComponentRegistry';
import { registerPostContentType } from './src/registry/contentTypeRegistry';
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
    // Register built-in CMS vue-component widgets
    import('./src/components/CmsBreadcrumb.vue').then((m) => {
      registerCmsVueComponent('CmsBreadcrumb', m.default);
    });
    import('./src/components/NativePricingPlans.vue').then((m) => {
      registerCmsVueComponent('NativePricingPlans', m.default);
    });
    import('./src/components/ContactForm.vue').then((m) => {
      registerCmsVueComponent('ContactForm', m.default);
    });

    // S47.3 — the "Category" (term-list) widget. Registered under both names so
    // an admin can drop a `vue-component` widget (content_json.component =
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

    // Custom Code widget — an admin drops it onto any page and pastes a raw
    // HTML/JS block (e.g. the Google gtag analytics snippet) into its
    // content_json.code; the widget builds + executes the <script> tags safely.
    import('./src/components/CustomCodeWidget.vue').then((m) => {
      registerCmsVueComponent('CustomCode', m.default);
    });

    // S47.3 — built-in `richtext` content-type renderer (placement: inline).
    // A post with no blocks renders its content_html as one implicit richtext
    // block; extension plugins register further types via the same registry.
    registerPostContentType('richtext', RichTextBlock, { placement: 'inline' });

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
