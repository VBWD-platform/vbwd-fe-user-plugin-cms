import type { IPlugin, IPlatformSDK } from 'vbwd-view-component';
import { registerCmsVueComponent } from './src/registry/vueComponentRegistry';
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
  },

  activate() { this._active = true; },
  deactivate() { this._active = false; },
};
