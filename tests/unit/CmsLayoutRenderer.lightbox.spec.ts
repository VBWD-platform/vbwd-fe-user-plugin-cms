import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import CmsLayoutRenderer from '../../src/components/CmsLayoutRenderer.vue';

/**
 * A laid-out page renders its body through this component's content area.
 * CmsPageTypeBase only reaches its own `<article>` branch when a page has NO
 * layout, so every live post arrives here — which is why wiring the viewer into
 * the fallback branch alone changed nothing in production.
 */
const layout = {
  slug: 'default',
  areas: [{ name: 'main', type: 'content' }],
} as never;

function mountLayout(contentHtml: string) {
  setActivePinia(createPinia());
  return mount(CmsLayoutRenderer, {
    props: { layout, contentHtml, contentBlocks: {}, pageAssignments: [] } as never,
    attachTo: document.body,
    global: { stubs: { RouterLink: true, CmsWidgetRenderer: true } },
  });
}

describe('CmsLayoutRenderer — image lightbox on the content-area path', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders body html into the content area', () => {
    const wrapper = mountLayout('<p>Body</p>');
    expect(wrapper.find('.cms-page__body').html()).toContain('Body');
  });

  it('opens the viewer for a body image', async () => {
    const wrapper = mountLayout('<img src="/a.png" alt="A figure">');
    expect(wrapper.find('[data-testid="cms-lightbox"]').exists()).toBe(false);

    await wrapper.find('.cms-page__body img').trigger('click');

    const box = wrapper.find('[data-testid="cms-lightbox"]');
    expect(box.exists()).toBe(true);
    expect(box.find('img').attributes('src')).toBe('/a.png');
  });

  it('marks eligible body images so the cursor advertises the affordance', async () => {
    const wrapper = mountLayout('<img src="/a.png" alt="A">');
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.find('.cms-page__body img').classes()).toContain('is-zoomable');
  });

  it('leaves linked body images alone', async () => {
    const wrapper = mountLayout('<a href="/x"><img src="/a.png" alt="A"></a>');
    await wrapper.find('.cms-page__body img').trigger('click');
    expect(wrapper.find('[data-testid="cms-lightbox"]').exists()).toBe(false);
  });
});
