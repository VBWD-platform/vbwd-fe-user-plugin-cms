import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import CmsWidgetRenderer from '../../src/components/CmsWidgetRenderer.vue';
import type { CmsWidgetData } from '../../src/stores/useCmsStore';

// Encode a UTF-8 string to base64 the same way the renderer decodes it
// (decodeURIComponent(escape(atob(b64)))), so a byte-clean round-trip holds.
function toBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

function htmlWidget(rawHtml: string, sourceCss: string | null = null): CmsWidgetData {
  return {
    id: 'w1',
    slug: 'w1',
    name: 'HTML widget',
    widget_type: 'html',
    content_json: { content: toBase64(rawHtml) },
    source_css: sourceCss,
    config: null,
  };
}

function happyDomSettings() {
  return (
    window as unknown as {
      happyDOM: {
        settings: {
          disableJavaScriptFileLoading: boolean;
          disableJavaScriptEvaluation: boolean;
        };
      };
    }
  ).happyDOM.settings;
}

afterEach(() => {
  // Restore evaluation/file-loading defaults between tests.
  const settings = happyDomSettings();
  settings.disableJavaScriptEvaluation = false;
  settings.disableJavaScriptFileLoading = false;
  delete (window as unknown as Record<string, unknown>).__ran;
});

describe('CmsWidgetRenderer html widget — script execution', () => {
  it('characterisation: a script-less html widget renders its markup unchanged', () => {
    const settings = happyDomSettings();
    settings.disableJavaScriptEvaluation = true;
    const wrapper = mount(CmsWidgetRenderer, {
      props: { widget: htmlWidget('<p class="greeting">Hello <strong>world</strong></p>') },
    });
    const container = wrapper.find('.cms-widget--html');
    expect(container.exists()).toBe(true);
    const greeting = container.find('p.greeting');
    expect(greeting.exists()).toBe(true);
    expect(greeting.html()).toContain('<strong>world</strong>');
    // No script tags appear for script-less content.
    expect(wrapper.element.querySelectorAll('script')).toHaveLength(0);
  });

  it('executes an inline <script> from the decoded html (side effect fires)', async () => {
    // happy-dom only evaluates an inline script when the host element is
    // connected to the document — attachTo mirrors the live page where the
    // widget is always mounted into the DOM.
    const wrapper = mount(CmsWidgetRenderer, {
      attachTo: document.body,
      props: {
        widget: htmlWidget(
          '<div>before</div><script>window.__ran = "yes";</script><div>after</div>',
        ),
      },
    });
    await wrapper.vm.$nextTick();
    expect((window as unknown as Record<string, unknown>).__ran).toBe('yes');
    // Visible (non-script) markup still renders.
    expect(wrapper.html()).toContain('before');
    expect(wrapper.html()).toContain('after');
    wrapper.unmount();
  });

  it('strips the dead <script> from the v-html output and injects exactly one live one', async () => {
    const settings = happyDomSettings();
    settings.disableJavaScriptFileLoading = true;
    const wrapper = mount(CmsWidgetRenderer, {
      props: {
        widget: htmlWidget('<p>x</p><script>window.__ran = "yes";</script>'),
      },
    });
    await wrapper.vm.$nextTick();
    // The v-html div must NOT carry a duplicate (inert) <script>; exactly one
    // live script (the appended one) exists in the whole widget subtree.
    expect(wrapper.element.querySelectorAll('script')).toHaveLength(1);
  });

  it('builds an external <script src async> for an external script tag', async () => {
    const settings = happyDomSettings();
    settings.disableJavaScriptFileLoading = true;
    const wrapper = mount(CmsWidgetRenderer, {
      props: {
        widget: htmlWidget(
          '<script async src="https://www.googletagmanager.com/gtag/js?id=G-XYZ"></script>',
        ),
      },
    });
    await wrapper.vm.$nextTick();
    const script = wrapper.element.querySelector('script') as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script?.getAttribute('src')).toBe(
      'https://www.googletagmanager.com/gtag/js?id=G-XYZ',
    );
    expect(script?.async).toBe(true);
  });

  it('is idempotent on content change — re-render does not double-inject', async () => {
    const settings = happyDomSettings();
    settings.disableJavaScriptFileLoading = true;
    settings.disableJavaScriptEvaluation = true;
    const first = htmlWidget('<script>noop1();</script>');
    const wrapper = mount(CmsWidgetRenderer, { props: { widget: first } });
    await wrapper.vm.$nextTick();
    expect(wrapper.element.querySelectorAll('script')).toHaveLength(1);

    // Change content -> exactly one script again (old one removed, new appended).
    await wrapper.setProps({ widget: htmlWidget('<script>noop2();</script>') });
    await wrapper.vm.$nextTick();
    expect(wrapper.element.querySelectorAll('script')).toHaveLength(1);
  });

  it('removes injected script nodes on unmount', async () => {
    const settings = happyDomSettings();
    settings.disableJavaScriptFileLoading = true;
    settings.disableJavaScriptEvaluation = true;
    const wrapper = mount(CmsWidgetRenderer, {
      props: { widget: htmlWidget('<script>noop();</script>') },
    });
    await wrapper.vm.$nextTick();
    const host = wrapper.element as HTMLElement;
    expect(host.querySelectorAll('script')).toHaveLength(1);
    wrapper.unmount();
    expect(host.querySelectorAll('script')).toHaveLength(0);
  });
});
