import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import CmsPageTypeBase from '../../src/views/CmsPageTypeBase.vue';

/**
 * CMS post and page bodies render through CmsPageTypeBase's own `v-html` — not
 * the html widget and not the richtext block. Shipping the viewer to only those
 * two left every post body image un-zoomable on the live site, so this pins the
 * third and most-used path.
 */
function mountPage(bodyHtml: string) {
  setActivePinia(createPinia());
  return mount(CmsPageTypeBase, {
    props: {
      page: {
        id: 'p1',
        title: 'A post',
        slug: 'a-post',
        content_html: bodyHtml,
        type: 'post',
      } as never,
      layout: null,
    },
    attachTo: document.body,
    global: { stubs: { RouterLink: true, TagChips: true, CustomFieldsDisplay: true, CmsLayoutRenderer: true } },
  });
}

describe('CmsPageTypeBase — image lightbox on the page-body path', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('opens the viewer for a body image', async () => {
    const wrapper = mountPage('<p>Copy</p><img src="/a.png" alt="A figure">');
    expect(wrapper.find('[data-testid="cms-lightbox"]').exists()).toBe(false);

    await wrapper.find('.cms-page__body img').trigger('click');

    const box = wrapper.find('[data-testid="cms-lightbox"]');
    expect(box.exists()).toBe(true);
    expect(box.find('img').attributes('src')).toBe('/a.png');
  });

  it('leaves a linked body image alone', async () => {
    const wrapper = mountPage('<a href="/x"><img src="/a.png" alt="A"></a>');
    await wrapper.find('.cms-page__body img').trigger('click');
    expect(wrapper.find('[data-testid="cms-lightbox"]').exists()).toBe(false);
  });
});
