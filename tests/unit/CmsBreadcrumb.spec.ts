/**
 * CmsBreadcrumb labels the current (last) crumb from the slug by default, but
 * uses a registered override label when one is set for the current route path.
 * Default (no override) behaviour must be unchanged.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, RouterLinkStub, type VueWrapper } from '@vue/test-utils';

const routePath = { value: '/category/backend/some-package' };

vi.mock('vue-router', () => ({
  useRoute: () => ({ get path() { return routePath.value; } }),
}));

vi.mock('../../src/stores/useCmsStore', () => ({
  useCmsStore: () => ({ currentPage: null, categories: [] }),
}));

import CmsBreadcrumb from '../../src/components/CmsBreadcrumb.vue';
import {
  setBreadcrumbLabel,
  clearBreadcrumbLabel,
} from '../../src/composables/useBreadcrumbLabel';

const mountedWrappers: VueWrapper[] = [];

function mountBreadcrumb() {
  const wrapper = mount(CmsBreadcrumb, {
    global: { stubs: { RouterLink: RouterLinkStub } },
  });
  mountedWrappers.push(wrapper);
  return wrapper;
}

describe('CmsBreadcrumb — current-crumb override', () => {
  beforeEach(() => {
    routePath.value = '/category/backend/some-package';
    clearBreadcrumbLabel('/category/backend/some-package');
  });

  afterEach(() => {
    while (mountedWrappers.length) mountedWrappers.pop()?.unmount();
  });

  it('labels the current crumb from the slug when no override is set', () => {
    const wrapper = mountBreadcrumb();
    expect(wrapper.find('.cms-breadcrumb__current').text()).toBe('Some Package');
  });

  it('uses the override label for the current crumb when one is set for the path', async () => {
    const wrapper = mountBreadcrumb();
    setBreadcrumbLabel('/category/backend/some-package', 'Tarot');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.cms-breadcrumb__current').text()).toBe('Tarot');
  });

  it('ignores an override registered for a different path', async () => {
    const wrapper = mountBreadcrumb();
    setBreadcrumbLabel('/category/backend/other', 'Tarot');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.cms-breadcrumb__current').text()).toBe('Some Package');
    clearBreadcrumbLabel('/category/backend/other');
  });
});
