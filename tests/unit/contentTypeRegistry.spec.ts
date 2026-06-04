import { describe, it, expect, beforeEach } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import {
  registerPostContentType,
  resolvePostContentType,
  resetPostContentTypes,
} from '../../src/registry/contentTypeRegistry';

const Dummy = defineComponent({ name: 'Dummy', render: () => h('div', 'dummy') });
const Other = defineComponent({ name: 'Other', render: () => h('div', 'other') });

describe('contentTypeRegistry', () => {
  beforeEach(() => {
    resetPostContentTypes();
  });

  it('registers and resolves a content type with its component', () => {
    registerPostContentType('youtube', Dummy, { placement: 'top' });
    const entry = resolvePostContentType('youtube');
    expect(entry).toBeDefined();
    expect(entry?.component).toBe(Dummy);
    expect(entry?.placement).toBe('top');
  });

  it('defaults placement to "inline" when not provided', () => {
    registerPostContentType('richtext', Dummy);
    expect(resolvePostContentType('richtext')?.placement).toBe('inline');
  });

  it('returns undefined for an unknown type (caller falls back, never throws)', () => {
    expect(() => resolvePostContentType('does-not-exist')).not.toThrow();
    expect(resolvePostContentType('does-not-exist')).toBeUndefined();
  });

  it('is reactive — a late registration triggers a re-render', async () => {
    const Probe = defineComponent({
      setup() {
        return () => {
          const entry = resolvePostContentType('late');
          return h('div', { class: 'probe' }, entry ? 'resolved' : 'fallback');
        };
      },
    });

    const wrapper = mount(Probe);
    expect(wrapper.text()).toBe('fallback');

    registerPostContentType('late', Other, { placement: 'top' });
    await nextTick();

    expect(wrapper.text()).toBe('resolved');
  });

  it('keeps independent registrations for different types', () => {
    registerPostContentType('a', Dummy);
    registerPostContentType('b', Other, { placement: 'bottom' });
    expect(resolvePostContentType('a')?.component).toBe(Dummy);
    expect(resolvePostContentType('b')?.component).toBe(Other);
    expect(resolvePostContentType('b')?.placement).toBe('bottom');
  });

  it('lets a consumer ref track registration state reactively', async () => {
    const seen = ref(resolvePostContentType('tracked') !== undefined);
    expect(seen.value).toBe(false);
  });
});
