import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import RichTextBlock from '../../src/components/RichTextBlock.vue';

/**
 * Every image inside CMS-rendered body copy (post bodies AND entity pages, which
 * share this renderer) should open in a zoom/pan viewer. The markup arrives as
 * an opaque HTML string through `v-html`, so the component delegates a click
 * listener rather than binding to elements it never authored.
 */
const body = (inner: string) => ({ data: { html: inner } });

function mountBlock(inner: string) {
  return mount(RichTextBlock, {
    props: body(inner),
    attachTo: document.body,
  });
}

describe('RichTextBlock — image lightbox', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the body html unchanged', () => {
    const wrapper = mountBlock('<p>Hello</p><img src="/a.png" alt="A">');
    expect(wrapper.find('p').text()).toBe('Hello');
    expect(wrapper.find('img').attributes('src')).toBe('/a.png');
  });

  it('is closed until an image is clicked', () => {
    const wrapper = mountBlock('<img src="/a.png" alt="A">');
    expect(wrapper.find('[data-testid="cms-lightbox"]').exists()).toBe(false);
  });

  it('opens the viewer on an image click, carrying src and alt', async () => {
    const wrapper = mountBlock('<img src="/a.png" alt="A chart">');
    await wrapper.find('img').trigger('click');

    const box = wrapper.find('[data-testid="cms-lightbox"]');
    expect(box.exists()).toBe(true);
    expect(box.find('img').attributes('src')).toBe('/a.png');
    expect(box.text()).toContain('A chart');
  });

  it('closes on the close button', async () => {
    const wrapper = mountBlock('<img src="/a.png" alt="A">');
    await wrapper.find('img').trigger('click');
    await wrapper.find('[data-testid="cms-lightbox-close"]').trigger('click');
    expect(wrapper.find('[data-testid="cms-lightbox"]').exists()).toBe(false);
  });

  it('closes on Escape — a CSS-only viewer cannot do this', async () => {
    const wrapper = mountBlock('<img src="/a.png" alt="A">');
    await wrapper.find('img').trigger('click');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="cms-lightbox"]').exists()).toBe(false);
  });

  it('cycles zoom levels and reports the active one', async () => {
    const wrapper = mountBlock('<img src="/a.png" alt="A">');
    await wrapper.find('img').trigger('click');

    const levels = wrapper.findAll('[data-testid="cms-lightbox-zoom"]');
    expect(levels.length).toBeGreaterThanOrEqual(3);
    expect(levels[0].classes()).toContain('is-active'); // opens at Fit

    await levels[2].trigger('click');
    expect(levels[2].classes()).toContain('is-active');
    expect(levels[0].classes()).not.toContain('is-active');
  });

  it('scales the image when zoomed past fit, so the stage can be panned', async () => {
    const wrapper = mountBlock('<img src="/a.png" alt="A">');
    await wrapper.find('img').trigger('click');

    const stageImg = () => wrapper.find('[data-testid="cms-lightbox"] img');
    const fitWidth = stageImg().attributes('style') ?? '';
    await wrapper.findAll('[data-testid="cms-lightbox-zoom"]')[2].trigger('click');
    expect(stageImg().attributes('style')).not.toBe(fitWidth);
    expect(stageImg().attributes('style')).toContain('width');
  });

  it('ignores images wrapped in a link — the link is the author’s intent', async () => {
    const wrapper = mountBlock('<a href="/somewhere"><img src="/a.png" alt="A"></a>');
    await wrapper.find('img').trigger('click');
    expect(wrapper.find('[data-testid="cms-lightbox"]').exists()).toBe(false);
  });

  it('ignores images opted out with data-nozoom', async () => {
    const wrapper = mountBlock('<img src="/logo.png" alt="Logo" data-nozoom>');
    await wrapper.find('img').trigger('click');
    expect(wrapper.find('[data-testid="cms-lightbox"]').exists()).toBe(false);
  });

  it('exposes the viewer as a labelled modal dialog', async () => {
    const wrapper = mountBlock('<img src="/a.png" alt="A chart">');
    await wrapper.find('img').trigger('click');
    const box = wrapper.find('[data-testid="cms-lightbox"]');
    expect(box.attributes('role')).toBe('dialog');
    expect(box.attributes('aria-modal')).toBe('true');
    expect(box.attributes('aria-label')).toContain('A chart');
  });

  it('marks zoomable images so they can advertise themselves', async () => {
    const wrapper = mountBlock('<img src="/a.png" alt="A"><a href="#"><img src="/b.png" alt="B"></a>');
    await wrapper.vm.$nextTick();
    const imgs = wrapper.findAll('.cms-richtext img');
    expect(imgs[0].classes()).toContain('is-zoomable');
    expect(imgs[1].classes()).not.toContain('is-zoomable');
  });
});
