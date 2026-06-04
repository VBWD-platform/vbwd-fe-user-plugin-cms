import { describe, it, expect, beforeAll } from 'vitest';
import { mount } from '@vue/test-utils';
import CustomCodeWidget from '../../src/components/CustomCodeWidget.vue';

// happy-dom otherwise EXECUTES inline scripts and network-fetches external
// <script src> the moment they are appended to a connected document. These unit
// tests assert DOM structure/attributes only — never script execution — so both
// JS evaluation and file loading are muted for the test window.
beforeAll(() => {
  const settings = (
    window as unknown as {
      happyDOM: {
        settings: { disableJavaScriptFileLoading: boolean; disableJavaScriptEvaluation: boolean };
      };
    }
  ).happyDOM.settings;
  settings.disableJavaScriptFileLoading = true;
  settings.disableJavaScriptEvaluation = true;
});

const INLINE_AND_EXTERNAL = `
  <script>window.dataLayer = window.dataLayer || [];</script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-XYZ"></script>
`;

describe('CustomCodeWidget', () => {
  it('builds an inline <script> with textContent (never v-html) for inline code', () => {
    const wrapper = mount(CustomCodeWidget, {
      props: { config: { code: '<script>gtag("config", "G-XYZ");</script>' } },
    });
    const script = wrapper.element.querySelector('script');
    expect(script).not.toBeNull();
    expect(script?.textContent).toContain('gtag("config", "G-XYZ")');
    // The body is in textContent, not parsed as child markup (no innerHTML/v-html).
    expect(script?.children).toHaveLength(0);
    expect(script?.getAttribute('src')).toBeNull();
  });

  it('builds an external <script src async> for an external script tag', () => {
    const wrapper = mount(CustomCodeWidget, {
      props: {
        config: {
          code: '<script async src="https://www.googletagmanager.com/gtag/js?id=G-XYZ"></script>',
        },
      },
    });
    const script = wrapper.element.querySelector('script') as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script?.getAttribute('src')).toBe(
      'https://www.googletagmanager.com/gtag/js?id=G-XYZ',
    );
    expect(script?.async).toBe(true);
  });

  it('builds BOTH an inline and an external script for the gtag analytics block', () => {
    const wrapper = mount(CustomCodeWidget, {
      props: { config: { code: INLINE_AND_EXTERNAL } },
    });
    const scripts = Array.from(
      wrapper.element.querySelectorAll('script'),
    ) as HTMLScriptElement[];
    expect(scripts).toHaveLength(2);
    const external = scripts.find((s) => s.getAttribute('src'));
    const inline = scripts.find((s) => !s.getAttribute('src'));
    expect(external?.getAttribute('src')).toContain('googletagmanager.com');
    expect(external?.async).toBe(true);
    expect(inline?.textContent).toContain('window.dataLayer');
  });

  it('is idempotent — re-rendering with the same code does NOT double-inject', async () => {
    const wrapper = mount(CustomCodeWidget, {
      props: { config: { code: '<script>noop();</script>' } },
    });
    expect(wrapper.element.querySelectorAll('script')).toHaveLength(1);
    // Force a re-render with the identical config object value.
    await wrapper.setProps({ config: { code: '<script>noop();</script>' } });
    expect(wrapper.element.querySelectorAll('script')).toHaveLength(1);
  });

  it('renders nothing and never crashes for empty / missing code', () => {
    const empty = mount(CustomCodeWidget, { props: { config: { code: '' } } });
    expect(empty.element.querySelectorAll('script')).toHaveLength(0);
    expect(empty.find('[data-testid="cms-custom-code"]').exists()).toBe(true);

    const missing = mount(CustomCodeWidget, { props: { config: {} } });
    expect(missing.element.querySelectorAll('script')).toHaveLength(0);
    expect(missing.find('[data-testid="cms-custom-code"]').exists()).toBe(true);
  });

  it('removes injected script nodes on unmount', () => {
    const wrapper = mount(CustomCodeWidget, {
      props: { config: { code: '<script>noop();</script>' } },
    });
    const host = wrapper.element as HTMLElement;
    expect(host.querySelectorAll('script')).toHaveLength(1);
    wrapper.unmount();
    expect(host.querySelectorAll('script')).toHaveLength(0);
  });
});
