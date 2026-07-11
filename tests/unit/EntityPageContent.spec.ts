/**
 * EntityPageContent — S128 (CMS Entity Pages).
 *
 * A reusable, purely-presentational public component that renders an entity's
 * attached CMS page (body + ordered content_blocks + scoped source_css) on any
 * fe-user detail page. Adopter plugins (dataset/shop/booking) drop it under
 * their existing description via `<EntityPageContent :owner-type="..."
 * :owner-id="..." />`.
 *
 * It fetches the public projection
 *   GET /api/v1/cms/entity-pages/<ownerType>/<ownerId>/<slot>
 * (no auth) → 200 published projection, or 404 when unlinked/unpublished.
 *
 * Engineering requirements (binding, restated): TDD-first (this is the RED
 * set); DevOps-first (runs cold local + CI, no live backend — the @/api client
 * is mocked); SOLID/DI (depends only on the @/api abstraction and the existing
 * RichTextBlock renderer); DRY (body + blocks render through the same
 * RichTextBlock the post body uses); Liskov (the 404/empty/error path collapses
 * the component instead of breaking the host detail page); clean code; no
 * overengineering. Quality guard: `bin/pre-commit-check.sh --plugin cms --unit`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { api } from '@/api';
import EntityPageContent from '../../src/components/EntityPageContent.vue';

vi.mock('@/api', () => ({ api: { get: vi.fn() } }));

const SEO = {
  meta_title: 'Widget X',
  meta_description: 'A great widget',
  canonical_url: '',
  og_title: '',
  og_description: '',
  og_image: '',
  twitter_card: '',
  robots: '',
  schema_json: '',
  focus_keyword: '',
};

function makeProjection(overrides: Record<string, unknown> = {}) {
  return {
    post_id: 'post-123',
    content_html: '<p class="epc-body">Hello entity body</p>',
    content_json: null,
    source_css: '.epc-body { color: rebeccapurple; }',
    content_blocks: [
      {
        id: 'block-2',
        area_name: 'gallery',
        content_html: '<div class="epc-gallery">Gallery</div>',
        source_css: '.epc-gallery { display: grid; }',
        sort_order: 2,
        content_json: null,
      },
      {
        id: 'block-1',
        area_name: 'specs',
        content_html: '<ul class="epc-specs"><li>Spec</li></ul>',
        source_css: '.epc-specs { margin: 0; }',
        sort_order: 1,
        content_json: null,
      },
    ],
    seo: SEO,
    ...overrides,
  };
}

function makeApiError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

function mountComponent(props: Record<string, unknown> = {}) {
  return mount(EntityPageContent, {
    props: { ownerType: 'dataset', ownerId: 'ds-1', ...props },
  });
}

describe('EntityPageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the public entity-page endpoint with owner + slot on mount', async () => {
    vi.mocked(api.get).mockResolvedValue(makeProjection());
    mountComponent({ ownerType: 'dataset', ownerId: 'ds-1', slot: 'sidebar' });
    await flushPromises();
    expect(api.get).toHaveBeenCalledWith('/cms/entity-pages/dataset/ds-1/sidebar');
  });

  it('defaults the slot to "main"', async () => {
    vi.mocked(api.get).mockResolvedValue(makeProjection());
    mountComponent({ ownerType: 'shop', ownerId: 'prod-9' });
    await flushPromises();
    expect(api.get).toHaveBeenCalledWith('/cms/entity-pages/shop/prod-9/main');
  });

  it('renders nothing on 404 (unlinked/unpublished) — the component collapses', async () => {
    vi.mocked(api.get).mockRejectedValue(makeApiError(404));
    const wrapper = mountComponent();
    await flushPromises();
    expect(wrapper.find('[data-testid="entity-page-content"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="entity-page-block"]').exists()).toBe(false);
  });

  it('renders nothing on any fetch error (graceful, does not break the host page)', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('boom'));
    const wrapper = mountComponent();
    await flushPromises();
    expect(wrapper.find('[data-testid="entity-page-content"]').exists()).toBe(false);
  });

  it('renders nothing when the projection has no body and no blocks', async () => {
    vi.mocked(api.get).mockResolvedValue(
      makeProjection({ content_html: '', content_blocks: [] }),
    );
    const wrapper = mountComponent();
    await flushPromises();
    expect(wrapper.find('[data-testid="entity-page-content"]').exists()).toBe(false);
  });

  it('renders the body and every content block on 200', async () => {
    vi.mocked(api.get).mockResolvedValue(makeProjection());
    const wrapper = mountComponent();
    await flushPromises();

    expect(wrapper.find('[data-testid="entity-page-content"]').exists()).toBe(true);
    expect(wrapper.html()).toContain('Hello entity body');
    const blocks = wrapper.findAll('[data-testid="entity-page-block"]');
    expect(blocks).toHaveLength(2);
    expect(wrapper.html()).toContain('Gallery');
    expect(wrapper.html()).toContain('epc-specs');
  });

  it('orders content blocks by sort_order', async () => {
    vi.mocked(api.get).mockResolvedValue(makeProjection());
    const wrapper = mountComponent();
    await flushPromises();

    const html = wrapper.html();
    // block-1 (sort_order 1, "specs") must appear before block-2 (sort_order 2, "gallery")
    expect(html.indexOf('epc-specs')).toBeLessThan(html.indexOf('epc-gallery'));
  });

  it('injects the page source_css and each block source_css as <style> tags', async () => {
    vi.mocked(api.get).mockResolvedValue(makeProjection());
    const wrapper = mountComponent();
    await flushPromises();

    const styleText = wrapper.findAll('style').map((s) => s.text()).join('\n');
    expect(styleText).toContain('.epc-body { color: rebeccapurple; }');
    expect(styleText).toContain('.epc-gallery { display: grid; }');
    expect(styleText).toContain('.epc-specs { margin: 0; }');
  });

  it('emits "loaded" with the fetched seo on a successful 200', async () => {
    vi.mocked(api.get).mockResolvedValue(makeProjection());
    const wrapper = mountComponent();
    await flushPromises();

    const events = wrapper.emitted('loaded');
    expect(events).toBeTruthy();
    expect(events?.[0]?.[0]).toEqual({ seo: SEO });
  });

  it('does not emit "loaded" on 404', async () => {
    vi.mocked(api.get).mockRejectedValue(makeApiError(404));
    const wrapper = mountComponent();
    await flushPromises();
    expect(wrapper.emitted('loaded')).toBeFalsy();
  });
});
