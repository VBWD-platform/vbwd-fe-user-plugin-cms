import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent } from 'vue';

import CmsLayoutRenderer from '../../src/components/CmsLayoutRenderer.vue';
import type {
  CmsLayout,
  CmsPageWidgetAssignment,
  CmsWidgetAssignment,
  CmsWidgetData,
} from '../../src/stores/useCmsStore';
import { registerCmsVueComponent } from '../../src/registry/vueComponentRegistry';

// S152 W1 — every widget assigned to an area renders (not just the first),
// in ascending sort_order; page assignments replace the layout's per area.

const HeadingProbe = defineComponent({
  name: 'HeadingProbe',
  props: { config: { type: Object, default: () => ({}) } },
  template: '<div class="heading-probe">{{ config.heading }}</div>',
});
registerCmsVueComponent('HeadingProbe', HeadingProbe);

function htmlWidget(widgetId: string, html: string): CmsWidgetData {
  return {
    id: widgetId,
    slug: widgetId.toLowerCase(),
    name: widgetId,
    widget_type: 'html',
    content_json: { content: btoa(html) },
    source_css: null,
    config: null,
  };
}

function vueWidget(widgetId: string, heading: string): CmsWidgetData {
  return {
    id: widgetId,
    slug: widgetId.toLowerCase(),
    name: widgetId,
    widget_type: 'vue-component',
    content_json: { component: 'HeadingProbe' },
    source_css: null,
    config: { heading },
  };
}

function layoutAssignment(areaName: string, sortOrder: number, widget: CmsWidgetData): CmsWidgetAssignment {
  return { widget_id: widget.id, area_name: areaName, sort_order: sortOrder, widget };
}

function pageAssignment(
  areaName: string,
  sortOrder: number,
  widget: CmsWidgetData,
  configOverride: CmsPageWidgetAssignment['config_override'] = null,
): CmsPageWidgetAssignment {
  return {
    area_name: areaName,
    widget_id: widget.id,
    sort_order: sortOrder,
    required_access_level_ids: [],
    widget,
    config_override: configOverride,
  };
}

function layoutWith(assignments: CmsWidgetAssignment[]): CmsLayout {
  return {
    id: 'L-MULTI',
    slug: 'multi-widget',
    name: 'Multi widget',
    areas: [
      { name: 'header', type: 'header', label: 'Header' },
      { name: 'content', type: 'content', label: 'Main' },
      { name: 'sidebar', type: 'sidebar', label: 'Sidebar' },
      { name: 'footer', type: 'footer', label: 'Footer' },
    ],
    assignments,
  };
}

function mountRenderer(layout: CmsLayout, pageAssignments: CmsPageWidgetAssignment[] = []) {
  return mount(CmsLayoutRenderer, {
    props: { layout, contentHtml: '<p>MAIN BODY</p>', contentBlocks: {}, pageAssignments },
  });
}

describe('CmsLayoutRenderer — S152 W1 all widgets of an area render', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders every layout widget of one area, in ascending sort_order', () => {
    const wrapper = mountRenderer(
      layoutWith([
        layoutAssignment('sidebar', 2, htmlWidget('W-SECOND', '<p>SECOND</p>')),
        layoutAssignment('sidebar', 1, htmlWidget('W-FIRST', '<p>FIRST</p>')),
      ]),
    );

    const sidebarAreas = wrapper.findAll('.cms-area--sidebar');
    expect(sidebarAreas).toHaveLength(1);
    const sidebarText = sidebarAreas[0].text();
    expect(sidebarText).toContain('FIRST');
    expect(sidebarText).toContain('SECOND');
    expect(sidebarText.indexOf('FIRST')).toBeLessThan(sidebarText.indexOf('SECOND'));
  });

  it('keeps API order for widgets that share a sort_order', () => {
    const wrapper = mountRenderer(
      layoutWith([
        layoutAssignment('sidebar', 0, htmlWidget('W-ALPHA', '<p>ALPHA</p>')),
        layoutAssignment('sidebar', 0, htmlWidget('W-BETA', '<p>BETA</p>')),
      ]),
    );

    const sidebarText = wrapper.find('.cms-area--sidebar').text();
    expect(sidebarText.indexOf('ALPHA')).toBeLessThan(sidebarText.indexOf('BETA'));
  });

  it('page assignments for an area replace ALL layout widgets of that area', () => {
    const wrapper = mountRenderer(
      layoutWith([
        layoutAssignment('sidebar', 0, htmlWidget('W-LAYOUT-ONE', '<p>LAYOUT ONE</p>')),
        layoutAssignment('sidebar', 1, htmlWidget('W-LAYOUT-TWO', '<p>LAYOUT TWO</p>')),
      ]),
      [
        pageAssignment('sidebar', 1, htmlWidget('W-PAGE-TWO', '<p>PAGE TWO</p>')),
        pageAssignment('sidebar', 0, htmlWidget('W-PAGE-ONE', '<p>PAGE ONE</p>')),
      ],
    );

    const sidebarText = wrapper.find('.cms-area--sidebar').text();
    expect(sidebarText).not.toContain('LAYOUT ONE');
    expect(sidebarText).not.toContain('LAYOUT TWO');
    expect(sidebarText.indexOf('PAGE ONE')).toBeGreaterThanOrEqual(0);
    expect(sidebarText.indexOf('PAGE ONE')).toBeLessThan(sidebarText.indexOf('PAGE TWO'));
  });

  it('page assignments for one area do not affect another area', () => {
    const wrapper = mountRenderer(
      layoutWith([
        layoutAssignment('sidebar', 0, htmlWidget('W-LAYOUT-SIDEBAR', '<p>LAYOUT SIDEBAR</p>')),
        layoutAssignment('footer', 0, htmlWidget('W-FOOTER-ONE', '<p>FOOTER ONE</p>')),
        layoutAssignment('footer', 1, htmlWidget('W-FOOTER-TWO', '<p>FOOTER TWO</p>')),
      ]),
      [pageAssignment('sidebar', 0, htmlWidget('W-PAGE-SIDEBAR', '<p>PAGE SIDEBAR</p>'))],
    );

    const footerText = wrapper.find('.cms-area--footer').text();
    expect(footerText).toContain('FOOTER ONE');
    expect(footerText).toContain('FOOTER TWO');
    const sidebarText = wrapper.find('.cms-area--sidebar').text();
    expect(sidebarText).toContain('PAGE SIDEBAR');
    expect(sidebarText).not.toContain('LAYOUT SIDEBAR');
  });

  it('applies each page assignment its own config_override', () => {
    const wrapper = mountRenderer(layoutWith([]), [
      pageAssignment('sidebar', 0, vueWidget('W-PROBE-ONE', 'Default one'), {
        config: { heading: 'Override one' },
      }),
      pageAssignment('sidebar', 1, vueWidget('W-PROBE-TWO', 'Default two')),
      pageAssignment('sidebar', 2, vueWidget('W-PROBE-THREE', 'Default three'), {
        config: { heading: 'Override three' },
      }),
    ]);

    const headings = wrapper.findAll('.cms-area--sidebar .heading-probe').map(probe => probe.text());
    expect(headings).toEqual(['Override one', 'Default two', 'Override three']);
  });

  it('skips an area that has no widget assigned', () => {
    const wrapper = mountRenderer(
      layoutWith([layoutAssignment('sidebar', 0, htmlWidget('W-ONLY', '<p>ONLY</p>'))]),
    );

    expect(wrapper.find('.cms-area--header').exists()).toBe(false);
    expect(wrapper.find('.cms-area--footer').exists()).toBe(false);
    expect(wrapper.find('.cms-area--sidebar').exists()).toBe(true);
  });

  it('renders a one-widget-per-area page byte-identically to the pre-W1 output', () => {
    const wrapper = mountRenderer(
      layoutWith([
        layoutAssignment('header', 0, htmlWidget('W-HEADER', '<nav>HEADER</nav>')),
        layoutAssignment('footer', 0, htmlWidget('W-FOOTER', '<p>FOOTER</p>')),
      ]),
      [pageAssignment('sidebar', 0, vueWidget('W-SIDEBAR', 'Sidebar heading'))],
    );

    expect(wrapper.html()).toMatchSnapshot();
  });
});
