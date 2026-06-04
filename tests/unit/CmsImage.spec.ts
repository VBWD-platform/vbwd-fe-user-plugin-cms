import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CmsImage from '../../src/components/CmsImage.vue';

describe('CmsImage (Core Web Vitals)', () => {
  it('emits a <picture> with AVIF + WebP sources and a fallback <img>', () => {
    const wrapper = mount(CmsImage, {
      props: {
        src: 'https://cdn/photo.jpg',
        avifSrc: 'https://cdn/photo.avif',
        webpSrc: 'https://cdn/photo.webp',
        width: 1200,
        height: 630,
        alt: 'A photo',
      },
    });
    expect(wrapper.find('picture').exists()).toBe(true);
    const sources = wrapper.findAll('source');
    const types = sources.map((s) => s.attributes('type'));
    expect(types).toContain('image/avif');
    expect(types).toContain('image/webp');
    expect(wrapper.find('img').attributes('src')).toBe('https://cdn/photo.jpg');
  });

  it('always sets explicit width/height to prevent CLS', () => {
    const wrapper = mount(CmsImage, {
      props: { src: 'https://cdn/p.jpg', width: 800, height: 600, alt: 'x' },
    });
    const img = wrapper.find('img');
    expect(img.attributes('width')).toBe('800');
    expect(img.attributes('height')).toBe('600');
  });

  it('lazy-loads below-the-fold images by default', () => {
    const wrapper = mount(CmsImage, {
      props: { src: 'https://cdn/p.jpg', width: 1, height: 1, alt: 'x' },
    });
    expect(wrapper.find('img').attributes('loading')).toBe('lazy');
  });

  it('eager-loads + high fetchpriority for the hero (LCP path)', () => {
    const wrapper = mount(CmsImage, {
      props: { src: 'https://cdn/p.jpg', width: 1, height: 1, alt: 'x', hero: true },
    });
    const img = wrapper.find('img');
    expect(img.attributes('loading')).toBe('eager');
    expect(img.attributes('fetchpriority')).toBe('high');
  });
});
