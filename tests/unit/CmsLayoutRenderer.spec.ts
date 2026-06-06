import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';

import CmsLayoutRenderer from '../../src/components/CmsLayoutRenderer.vue';
import type { CmsLayout, CmsWidgetData } from '../../src/stores/useCmsStore';

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
});
