import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import CmsWidgetRenderer from '../../src/components/CmsWidgetRenderer.vue';

/**
 * A CMS **post body** is laid out as an `html` widget, not as a richtext block —
 * so shipping the image viewer only in RichTextBlock left every post image
 * un-zoomable while entity pages worked. This pins the widget path so that gap
 * cannot reopen silently.
 */
const encode = (html: string) =>
  typeof btoa === 'function'
    ? btoa(unescape(encodeURIComponent(html)))
    : Buffer.from(html, 'utf-8').toString('base64');

function mountHtmlWidget(inner: string) {
  return mount(CmsWidgetRenderer, {
    props: {
      widget: {
        widget_type: 'html',
        slug: 'body',
        content_json: { content: encode(inner) },
        source_css: null,
      } as never,
    },
    attachTo: document.body,
    global: { stubs: { RouterLink: true } },
  });
}

describe('CmsWidgetRenderer — image lightbox on the html-widget path', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the decoded widget html', () => {
    const wrapper = mountHtmlWidget('<p>Body copy</p><img src="/a.png" alt="A">');
    expect(wrapper.html()).toContain('Body copy');
  });

  it('opens the viewer when a body image is clicked', async () => {
    const wrapper = mountHtmlWidget('<img src="/a.png" alt="A chart">');
    expect(wrapper.find('[data-testid="cms-lightbox"]').exists()).toBe(false);

    await wrapper.find('.cms-widget--html img').trigger('click');

    const box = wrapper.find('[data-testid="cms-lightbox"]');
    expect(box.exists()).toBe(true);
    expect(box.find('img').attributes('src')).toBe('/a.png');
  });

  it('closes again from the close button', async () => {
    const wrapper = mountHtmlWidget('<img src="/a.png" alt="A">');
    await wrapper.find('.cms-widget--html img').trigger('click');
    await wrapper.find('[data-testid="cms-lightbox-close"]').trigger('click');
    expect(wrapper.find('[data-testid="cms-lightbox"]').exists()).toBe(false);
  });

  it('leaves linked images alone', async () => {
    const wrapper = mountHtmlWidget('<a href="/x"><img src="/a.png" alt="A"></a>');
    await wrapper.find('.cms-widget--html img').trigger('click');
    expect(wrapper.find('[data-testid="cms-lightbox"]').exists()).toBe(false);
  });
});
