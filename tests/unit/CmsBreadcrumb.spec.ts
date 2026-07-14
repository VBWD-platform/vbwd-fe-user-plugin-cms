/**
 * The CmsBreadcrumb widget is now a thin adapter: it renders the core
 * `<VbwdBreadcrumb>` (which asks the registered breadcrumb providers for the
 * trail) and maps its own `config` (separator / css / max_label_length) onto
 * the core component's props. The old URL-slicing crumb logic is gone —
 * the CMS breadcrumb PROVIDER now owns trail construction.
 */
import { describe, it, expect, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';

// Stub the core component so we can assert the props the widget passes through.
// Hoisted so the (hoisted) vi.mock factory can reference it safely.
const { VbwdBreadcrumbStub } = vi.hoisted(() => ({
  VbwdBreadcrumbStub: {
    name: 'VbwdBreadcrumb',
    props: ['separator', 'css', 'maxLabelLength'],
    template: '<nav class="vbwd-breadcrumb-stub" />',
  },
}));

vi.mock('vbwd-view-component', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, VbwdBreadcrumb: VbwdBreadcrumbStub };
});

import CmsBreadcrumb from '../../src/components/CmsBreadcrumb.vue';

describe('CmsBreadcrumb widget', () => {
  it('renders the core VbwdBreadcrumb', () => {
    const wrapper = shallowMount(CmsBreadcrumb, {
      global: { stubs: { VbwdBreadcrumb: VbwdBreadcrumbStub } },
    });
    expect(wrapper.findComponent(VbwdBreadcrumbStub).exists()).toBe(true);
  });

  it('maps config.separator / css / max_label_length onto the core props', () => {
    const wrapper = shallowMount(CmsBreadcrumb, {
      props: {
        config: { separator: '›', css: '.x{}', max_label_length: 24 },
      },
      global: { stubs: { VbwdBreadcrumb: VbwdBreadcrumbStub } },
    });

    const core = wrapper.findComponent(VbwdBreadcrumbStub);
    expect(core.props('separator')).toBe('›');
    expect(core.props('css')).toBe('.x{}');
    expect(core.props('maxLabelLength')).toBe(24);
  });
});
