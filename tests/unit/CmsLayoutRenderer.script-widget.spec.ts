import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';

import CmsLayoutRenderer from '../../src/components/CmsLayoutRenderer.vue';
import CustomCodeWidget from '../../src/components/CustomCodeWidget.vue';
import { registerCmsVueComponent } from '../../src/registry/vueComponentRegistry';
import type { CmsLayout, CmsWidgetData } from '../../src/stores/useCmsStore';

// This is the replacement for the abandoned site-wide GlobalWidgets mechanism:
// a code-snippet widget (an `html` widget carrying an inline <script>, AND the
// `CustomCode` vue-component widget) must render AND EXECUTE its scripts when an
// admin places it into a layout area — rendered through CmsLayoutRenderer →
// CmsWidgetRenderer. These tests prove the LAYOUT placement path fires scripts,
// so no global root-mount is needed.

// Encode UTF-8 to base64 the same way CmsWidgetRenderer decodes it
// (decodeURIComponent(escape(atob(b64)))).
function toBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

function scriptHtmlWidget(id: string, slug: string, rawHtml: string): CmsWidgetData {
  return {
    id,
    slug,
    name: slug,
    widget_type: 'html',
    content_json: { content: toBase64(rawHtml) },
    source_css: null,
    config: null,
  };
}

function customCodeWidget(id: string, slug: string, code: string): CmsWidgetData {
  return {
    id,
    slug,
    name: slug,
    widget_type: 'vue-component',
    content_json: { component: 'CustomCode' },
    source_css: null,
    config: { code },
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  // CustomCode is normally registered by the plugin's install(); register it
  // here so the vue-component widget resolves to the executing component.
  registerCmsVueComponent('CustomCode', CustomCodeWidget);
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__layoutHtmlRan;
  delete (window as unknown as Record<string, unknown>).__layoutCustomCodeRan;
});

describe('CmsLayoutRenderer — code snippets execute via LAYOUT placement', () => {
  it('executes an inline <script> from an html widget placed in a layout area', async () => {
    const layout: CmsLayout = {
      id: 'L1',
      slug: 'snippet',
      name: 'Snippet',
      areas: [
        { name: 'content', type: 'content', label: 'Main' },
        { name: 'footer', type: 'page-widget', label: 'Footer' },
      ],
      assignments: [
        {
          widget_id: 'W-HTML',
          area_name: 'footer',
          sort_order: 0,
          widget: scriptHtmlWidget(
            'W-HTML',
            'analytics',
            '<div>before</div><script>window.__layoutHtmlRan = "yes";</script>',
          ),
        },
      ],
    };

    const wrapper = mount(CmsLayoutRenderer, {
      attachTo: document.body,
      props: {
        layout,
        contentHtml: '<p>MAIN BODY</p>',
        contentBlocks: {},
        pageAssignments: [],
      },
    });
    await wrapper.vm.$nextTick();

    // Side effect fired → the script the admin placed in the layout executed.
    expect((window as unknown as Record<string, unknown>).__layoutHtmlRan).toBe('yes');
    // A live <script> was injected into the widget subtree.
    expect(wrapper.element.querySelectorAll('script').length).toBeGreaterThanOrEqual(1);
    // Non-script markup still renders.
    expect(wrapper.html()).toContain('before');
    wrapper.unmount();
  });

  it('executes a CustomCode vue-component widget placed in a layout area', async () => {
    const layout: CmsLayout = {
      id: 'L2',
      slug: 'snippet',
      name: 'Snippet',
      areas: [
        { name: 'content', type: 'content', label: 'Main' },
        { name: 'header', type: 'page-widget', label: 'Header' },
      ],
      assignments: [
        {
          widget_id: 'W-CC',
          area_name: 'header',
          sort_order: 0,
          widget: customCodeWidget(
            'W-CC',
            'gtag',
            '<script>window.__layoutCustomCodeRan = "yes";</script>',
          ),
        },
      ],
    };

    const wrapper = mount(CmsLayoutRenderer, {
      attachTo: document.body,
      props: {
        layout,
        contentHtml: '<p>MAIN BODY</p>',
        contentBlocks: {},
        pageAssignments: [],
      },
    });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect((window as unknown as Record<string, unknown>).__layoutCustomCodeRan).toBe('yes');
    wrapper.unmount();
  });
});
