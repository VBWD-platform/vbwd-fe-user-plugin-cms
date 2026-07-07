import { describe, it, expect, beforeAll } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import CmsWidgetRenderer from '../../src/components/CmsWidgetRenderer.vue';
import { registerCmsVueComponent } from '../../src/registry/vueComponentRegistry';
import type { CmsWidgetData, CmsMenuItemData } from '../../src/stores/useCmsStore';

// A stand-in vue widget that echoes the config it receives, so we can assert
// the wrapper still passes :config (incl. widget_slug) down to the resolved
// component.
const EchoWidget = defineComponent({
  name: 'EchoWidget',
  props: { config: { type: Object, default: () => ({}) } },
  setup(props) {
    return () =>
      h('div', { class: 'echo-widget' }, String((props.config as Record<string, unknown>).widget_slug ?? ''));
  },
});

beforeAll(() => {
  registerCmsVueComponent('EchoWidget', EchoWidget);
});

function toBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

function vueWidget(
  slug: string,
  sourceCss: string | null,
  config: Record<string, unknown> | null = null,
): CmsWidgetData {
  return {
    id: `vue-${slug}`,
    slug,
    name: `Vue widget ${slug}`,
    widget_type: 'vue-component',
    content_json: { component: 'EchoWidget' },
    source_css: sourceCss,
    config,
  };
}

function htmlWidget(rawHtml: string, sourceCss: string | null): CmsWidgetData {
  return {
    id: 'html-1',
    slug: 'promo',
    name: 'HTML widget',
    widget_type: 'html',
    content_json: { content: toBase64(rawHtml) },
    source_css: sourceCss,
    config: null,
  };
}

function menuWidget(sourceCss: string | null): CmsWidgetData {
  const items: CmsMenuItemData[] = [
    {
      id: 'm1',
      parent_id: null,
      label: 'Home',
      url: '/',
      page_slug: null,
      target: '_self',
      icon: null,
      sort_order: 0,
    },
  ];
  return {
    id: 'menu-1',
    slug: 'main-nav',
    name: 'Main nav',
    widget_type: 'menu',
    content_json: null,
    source_css: sourceCss,
    config: null,
    menu_items: items,
  };
}

describe('CmsWidgetRenderer vue-component widget — source_css injection', () => {
  it('injects source_css as a <style> and carries the per-slug class', () => {
    const css = '.cms-widget--search input { border-radius: 8px; }';
    const wrapper = mount(CmsWidgetRenderer, {
      props: { widget: vueWidget('search', css) },
    });

    // Per-slug wrapper hook.
    expect(wrapper.find('.cms-widget--vue').exists()).toBe(true);
    expect(wrapper.find('.cms-widget--search').exists()).toBe(true);

    // Injected <style> carries the widget's CSS.
    const style = wrapper.find('style');
    expect(style.exists()).toBe(true);
    expect(style.text()).toContain('border-radius: 8px');
  });

  it('renders no <style> when the vue widget has no source_css', () => {
    const wrapper = mount(CmsWidgetRenderer, {
      props: { widget: vueWidget('search', null) },
    });
    expect(wrapper.find('.cms-widget--search').exists()).toBe(true);
    expect(wrapper.find('style').exists()).toBe(false);
  });

  it('still passes :config (incl. widget_slug) to the resolved component after wrapping', () => {
    const wrapper = mount(CmsWidgetRenderer, {
      props: { widget: vueWidget('search', null, { placeholder: 'Search…' }) },
    });
    const echo = wrapper.find('.echo-widget');
    expect(echo.exists()).toBe(true);
    // widget_slug is merged into the config passed down.
    expect(echo.text()).toBe('search');
  });
});

describe('CmsWidgetRenderer — html/menu source_css injection (regression)', () => {
  it('html widget still injects its source_css as a <style>', () => {
    const css = '.cms-widget--promo { color: red; }';
    const wrapper = mount(CmsWidgetRenderer, {
      props: { widget: htmlWidget('<p>Hi</p>', css) },
    });
    const style = wrapper.find('.cms-widget--html style');
    expect(style.exists()).toBe(true);
    expect(style.text()).toContain('color: red');
  });

  it('menu widget still injects its source_css as a <style>', () => {
    const css = '.cms-widget--main-nav { gap: 2rem; }';
    const wrapper = mount(CmsWidgetRenderer, {
      props: { widget: menuWidget(css) },
    });
    const style = wrapper.find('.cms-widget--menu style');
    expect(style.exists()).toBe(true);
    expect(style.text()).toContain('gap: 2rem');
  });
});
