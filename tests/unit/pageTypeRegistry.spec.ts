import { describe, it, expect, beforeEach } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import {
  registerCmsPageType,
  resolveCmsPageType,
  unregisterCmsPageType,
  resetCmsPageTypes,
} from '../../src/registry/pageTypeRegistry';

const PageComponent = defineComponent({ name: 'PageComponent', render: () => h('div', 'page') });
const PostComponent = defineComponent({ name: 'PostComponent', render: () => h('div', 'post') });

describe('pageTypeRegistry', () => {
  beforeEach(() => {
    resetCmsPageTypes();
  });

  it('registers and resolves a page type by slug', () => {
    registerCmsPageType('page', PageComponent);
    expect(resolveCmsPageType('page')).toBe(PageComponent);
  });

  it('returns undefined for an unknown type (caller falls back, never throws)', () => {
    expect(() => resolveCmsPageType('does-not-exist')).not.toThrow();
    expect(resolveCmsPageType('does-not-exist')).toBeUndefined();
  });

  it('keeps independent registrations for different types', () => {
    registerCmsPageType('page', PageComponent);
    registerCmsPageType('post', PostComponent);
    expect(resolveCmsPageType('page')).toBe(PageComponent);
    expect(resolveCmsPageType('post')).toBe(PostComponent);
  });

  it('unregisters a single type, leaving others intact', () => {
    registerCmsPageType('page', PageComponent);
    registerCmsPageType('post', PostComponent);
    unregisterCmsPageType('post');
    expect(resolveCmsPageType('post')).toBeUndefined();
    expect(resolveCmsPageType('page')).toBe(PageComponent);
  });

  it('is reactive — a late registration triggers a re-render', async () => {
    const Probe = defineComponent({
      setup() {
        return () => {
          const component = resolveCmsPageType('video');
          return h('div', { class: 'probe' }, component ? 'resolved' : 'fallback');
        };
      },
    });

    const wrapper = mount(Probe);
    expect(wrapper.text()).toBe('fallback');

    registerCmsPageType('video', PostComponent);
    await nextTick();

    expect(wrapper.text()).toBe('resolved');
  });
});
