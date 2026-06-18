import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';

import { defineComponent } from 'vue';

import CmsLayoutRenderer from '../../src/components/CmsLayoutRenderer.vue';
import type { CmsLayout, CmsWidgetData } from '../../src/stores/useCmsStore';
import { registerCmsVueComponent } from '../../src/registry/vueComponentRegistry';

// A vue-component widget renders its merged `config` so a test can read the
// effective config the renderer passed down (CmsWidgetRenderer spreads
// `widget.config` into the child's `:config` prop).
const ConfigProbe = defineComponent({
  name: 'ConfigProbe',
  props: { config: { type: Object, default: () => ({}) } },
  template: '<div class="config-probe">{{ config.heading }}</div>',
});
registerCmsVueComponent('ConfigProbe', ConfigProbe);

function vueWidget(id: string, slug: string, config: Record<string, unknown> | null): CmsWidgetData {
  return {
    id,
    slug,
    name: slug,
    widget_type: 'vue-component',
    content_json: { component: 'ConfigProbe' },
    source_css: null,
    config,
  };
}

// An html widget renders base64-decoded content_json.content (see CmsWidgetRenderer).
function htmlWidget(id: string, slug: string, html: string): CmsWidgetData {
  return {
    id,
    slug,
    name: slug,
    widget_type: 'html',
    content_json: { content: btoa(html) },
    source_css: null,
    config: null,
  };
}

const LAYOUT: CmsLayout = {
  id: 'L1',
  slug: 'multi',
  name: 'Multi',
  areas: [
    { name: 'content', type: 'content', label: 'Main' },
    { name: 'content-above', type: 'content', label: 'Above' },
    { name: 'sidebar', type: 'page-widget', label: 'Sidebar' },
  ],
  assignments: [
    {
      widget_id: 'W-LAYOUT',
      area_name: 'sidebar',
      sort_order: 0,
      widget: htmlWidget('W-LAYOUT', 'layout-widget', '<p>LAYOUT WIDGET</p>'),
    },
  ],
};

describe('CmsLayoutRenderer — S55.3 render proof', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders each content area from its content_blocks, falling back to contentHtml for the primary', () => {
    const wrapper = mount(CmsLayoutRenderer, {
      props: {
        layout: LAYOUT,
        contentHtml: '<p>MAIN BODY</p>',
        contentBlocks: {
          'content-above': { content_html: '<p>ABOVE BLOCK</p>' },
        },
        pageAssignments: [],
      },
    });

    // Primary area: no block for "content" → falls back to contentHtml.
    expect(wrapper.find('.cms-area--content').html()).toContain('MAIN BODY');
    // Second content area: renders its own block, not the main body.
    const above = wrapper.find('.cms-area--content-above');
    expect(above.exists()).toBe(true);
    expect(above.html()).toContain('ABOVE BLOCK');
    expect(above.html()).not.toContain('MAIN BODY');
  });

  it('renders the per-page widget over the layout widget for the same area', () => {
    const wrapper = mount(CmsLayoutRenderer, {
      props: {
        layout: LAYOUT,
        contentHtml: '<p>MAIN BODY</p>',
        contentBlocks: {},
        pageAssignments: [
          {
            area_name: 'sidebar',
            widget_id: 'W-PAGE',
            sort_order: 0,
            required_access_level_ids: [],
            widget: htmlWidget('W-PAGE', 'page-widget', '<p>PAGE WIDGET</p>'),
          },
        ],
      },
    });

    const html = wrapper.html();
    expect(html).toContain('PAGE WIDGET');
    expect(html).not.toContain('LAYOUT WIDGET');
  });

  it('falls back to the layout widget when the page has no assignment for the area', () => {
    const wrapper = mount(CmsLayoutRenderer, {
      props: {
        layout: LAYOUT,
        contentHtml: '<p>MAIN BODY</p>',
        contentBlocks: {},
        pageAssignments: [],
      },
    });

    expect(wrapper.html()).toContain('LAYOUT WIDGET');
  });

  it('merges a vue-component override.config over the widget default config', () => {
    const wrapper = mount(CmsLayoutRenderer, {
      props: {
        layout: LAYOUT,
        contentHtml: '<p>MAIN BODY</p>',
        contentBlocks: {},
        pageAssignments: [
          {
            area_name: 'sidebar',
            widget_id: 'W-PAGE',
            sort_order: 0,
            required_access_level_ids: [],
            widget: vueWidget('W-PAGE', 'cfg', { heading: 'Default heading' }),
            config_override: { config: { heading: 'Per-page heading' } },
          },
        ],
      },
    });

    const probe = wrapper.find('.config-probe');
    expect(probe.exists()).toBe(true);
    expect(probe.text()).toBe('Per-page heading');
  });

  it('applies a vue-component override.source_css onto the rendered widget', () => {
    const wrapper = mount(CmsLayoutRenderer, {
      props: {
        layout: LAYOUT,
        contentHtml: '<p>MAIN BODY</p>',
        contentBlocks: {},
        pageAssignments: [
          {
            area_name: 'sidebar',
            widget_id: 'W-PAGE',
            sort_order: 0,
            required_access_level_ids: [],
            widget: vueWidget('W-PAGE', 'cfg', { heading: 'Default heading' }),
            config_override: { source_css: '.config-probe { color: red; }' },
          },
        ],
      },
    });

    // Config untouched (no override.config), CSS applied to the widget.
    expect(wrapper.find('.config-probe').text()).toBe('Default heading');
  });

  it('uses the widget default config when the page assignment has no override', () => {
    const wrapper = mount(CmsLayoutRenderer, {
      props: {
        layout: LAYOUT,
        contentHtml: '<p>MAIN BODY</p>',
        contentBlocks: {},
        pageAssignments: [
          {
            area_name: 'sidebar',
            widget_id: 'W-PAGE',
            sort_order: 0,
            required_access_level_ids: [],
            widget: vueWidget('W-PAGE', 'cfg', { heading: 'Default heading' }),
          },
        ],
      },
    });

    expect(wrapper.find('.config-probe').text()).toBe('Default heading');
  });

  it('applies an html override.content_html and override.source_css for this page', () => {
    const wrapper = mount(CmsLayoutRenderer, {
      props: {
        layout: LAYOUT,
        contentHtml: '<p>MAIN BODY</p>',
        contentBlocks: {},
        pageAssignments: [
          {
            area_name: 'sidebar',
            widget_id: 'W-PAGE',
            sort_order: 0,
            required_access_level_ids: [],
            widget: htmlWidget('W-PAGE', 'page-widget', '<p>WIDGET DEFAULT HTML</p>'),
            config_override: {
              content_html: '<p>PER-PAGE HTML</p>',
              source_css: '.cms-widget--html { color: green; }',
            },
          },
        ],
      },
    });

    const html = wrapper.html();
    expect(html).toContain('PER-PAGE HTML');
    expect(html).not.toContain('WIDGET DEFAULT HTML');
    // The per-page CSS is injected via the renderer's <style> block (the
    // rendered output may reflow whitespace, so match the selector + colour).
    expect(html).toContain('.cms-widget--html');
    expect(html).toContain('color: green');
  });

  it('applies a menu override.menu_items for this page', () => {
    const menuWidget: CmsWidgetData = {
      id: 'W-PAGE',
      slug: 'page-menu',
      name: 'page-menu',
      widget_type: 'menu',
      content_json: null,
      source_css: null,
      config: null,
      menu_items: [
        { id: 'm1', parent_id: null, label: 'Default Item', url: '/default', page_slug: null, target: '_self', icon: null, sort_order: 0 },
      ],
    };

    const wrapper = mount(CmsLayoutRenderer, {
      props: {
        layout: LAYOUT,
        contentHtml: '<p>MAIN BODY</p>',
        contentBlocks: {},
        pageAssignments: [
          {
            area_name: 'sidebar',
            widget_id: 'W-PAGE',
            sort_order: 0,
            required_access_level_ids: [],
            widget: menuWidget,
            config_override: {
              menu_items: [
                { id: 'm2', parent_id: null, label: 'Per-page Item', url: '/per-page', page_slug: null, target: '_self', icon: null, sort_order: 0 },
              ],
            },
          },
        ],
      },
    });

    const html = wrapper.html();
    expect(html).toContain('Per-page Item');
    expect(html).not.toContain('Default Item');
  });

  it('does not apply a page override to a layout-level assignment', () => {
    const layoutWithVueWidget: CmsLayout = {
      ...LAYOUT,
      assignments: [
        {
          widget_id: 'W-LAYOUT',
          area_name: 'sidebar',
          sort_order: 0,
          widget: vueWidget('W-LAYOUT', 'layout-cfg', { heading: 'Layout heading' }),
        },
      ],
    };

    const wrapper = mount(CmsLayoutRenderer, {
      props: {
        layout: layoutWithVueWidget,
        contentHtml: '<p>MAIN BODY</p>',
        contentBlocks: {},
        // A page override exists but for a DIFFERENT area — must not leak onto
        // the layout-level sidebar assignment.
        pageAssignments: [
          {
            area_name: 'footer',
            widget_id: 'W-OTHER',
            sort_order: 0,
            required_access_level_ids: [],
            config_override: { config: { heading: 'Should not apply' } },
          },
        ],
      },
    });

    expect(wrapper.find('.config-probe').text()).toBe('Layout heading');
  });
});
