/**
 * S77 — the shared CMS page render mounts the read-only tags + custom-fields
 * display components from the new core payload keys (`tags`, `custom_fields`,
 * `custom_field_defs`), ALONGSIDE the legacy `terms` taxonomy (untouched). One
 * home in CmsPageTypeBase so both page and post renders show them.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { TagChips, CustomFieldsDisplay } from 'vbwd-view-component';

vi.mock('@/api', () => ({ api: { get: vi.fn(async () => ({})) }, isAuthenticated: () => false }));

import CmsPageTypeBase from '../../src/views/CmsPageTypeBase.vue';
import type { CmsPageItem } from '../../src/stores/useCmsStore';

function makePage(overrides: Partial<CmsPageItem> = {}): CmsPageItem {
  return {
    id: 'p-1',
    slug: 'my-page',
    type: 'page',
    title: 'My Page',
    language: 'en',
    content_json: {},
    sort_order: 0,
    meta_title: null,
    meta_description: null,
    og_title: null,
    og_description: null,
    og_image_url: null,
    canonical_url: null,
    robots: 'index,follow',
    schema_json: null,
    updated_at: '',
    ...overrides,
  };
}

function mountBase(page: CmsPageItem) {
  return mount(CmsPageTypeBase, {
    props: { page, layout: null },
    global: {
      stubs: { CmsLayoutRenderer: true },
    },
  });
}

describe('CmsPageTypeBase — S77 tags + custom fields', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders TagChips + CustomFieldsDisplay from the core payload keys', () => {
    const wrapper = mountBase(
      makePage({
        tags: ['featured'],
        custom_fields: { author: 'Jane' },
        custom_field_defs: [{ key: 'author', label: 'Author', type: 'text' }],
      }),
    );

    expect(wrapper.find('[data-testid="page-tags-custom-fields"]').exists()).toBe(true);
    const tagChips = wrapper.findComponent(TagChips);
    expect(tagChips.exists()).toBe(true);
    expect((tagChips.props() as { tags: string[] }).tags).toEqual(['featured']);
    const cfDisplay = wrapper.findComponent(CustomFieldsDisplay);
    expect(cfDisplay.exists()).toBe(true);
    expect((cfDisplay.props() as { customFields: Record<string, unknown> }).customFields).toEqual({ author: 'Jane' });
  });

  it('does not render the block when there are no tags or custom fields', () => {
    const wrapper = mountBase(makePage({ tags: [], custom_fields: {} }));

    expect(wrapper.find('[data-testid="page-tags-custom-fields"]').exists()).toBe(false);
  });
});
