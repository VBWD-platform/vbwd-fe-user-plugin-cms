/**
 * AddonCatalog — public CMS vue-component widget that lists the active add-ons.
 *
 * The widget fetches ``GET /api/v1/addons/`` (envelope ``{ addons: [...] }``) and
 * renders one card per add-on (name + description + price). Price is rendered
 * through the shared <PriceDisplay> fed by the S85 ``price_info`` block
 * (``net_amount`` / ``gross_amount`` + nested ``price.currency``) — NO bespoke
 * tax math in the widget (D1). These oracle tests cover the card render, the
 * loading state, and the empty state, with the API mocked.
 *
 * Engineering requirements (binding, restated): TDD-first (this is the RED set);
 * DevOps-first (runs cold local + CI, no live backend); SOLID/DI (depends on the
 * @/api abstraction); DRY (price via the shared PriceDisplay/money path); Liskov
 * (the disabled/empty path does not break callers); clean code; no
 * overengineering. Quality guard: ``bin/pre-commit-check.sh --plugin cms --unit``.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { api } from '@/api';
import AddonCatalog from '../../src/components/AddonCatalog.vue';

vi.mock('@/api', () => ({ api: { get: vi.fn() } }));

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  missing: (_locale, key) => key,
  messages: { en: { price: { nettoTag: 'netto price' } } },
});

function makeAddon(slug: string, priceInfo?: Record<string, unknown>) {
  return {
    id: `addon-${slug}`,
    slug,
    name: `Add-on ${slug}`,
    description: `Description for ${slug}`,
    price: 9.99,
    is_active: true,
    price_info: priceInfo ?? {
      net_amount: '9.99',
      gross_amount: '11.89',
      taxes: [],
      price: { netto: 9.99, taxes: [], brutto: 11.89, currency: 'EUR' },
    },
  };
}

function mountWidget(config: Record<string, unknown> = {}) {
  return mount(AddonCatalog, {
    props: { config },
    global: {
      plugins: [i18n],
      stubs: { RouterLink: RouterLinkStub },
    },
  });
}

describe('AddonCatalog widget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading state before the addons resolve', () => {
    let resolveFetch: (value: unknown) => void = () => undefined;
    vi.mocked(api.get).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const wrapper = mountWidget();
    expect(wrapper.find('[data-testid="addon-catalog-loading"]').exists()).toBe(true);
    resolveFetch({ addons: [] });
  });

  it('fetches the public addons endpoint on mount', async () => {
    vi.mocked(api.get).mockResolvedValue({ addons: [] });
    mountWidget();
    await flushPromises();
    expect(api.get).toHaveBeenCalledWith('/addons/');
  });

  it('renders one card per addon with name and price', async () => {
    vi.mocked(api.get).mockResolvedValue({
      addons: [makeAddon('alpha'), makeAddon('beta')],
    });
    const wrapper = mountWidget();
    await flushPromises();

    const cards = wrapper.findAll('[data-testid="addon-card"]');
    expect(cards).toHaveLength(2);
    expect(wrapper.text()).toContain('Add-on alpha');
    expect(wrapper.text()).toContain('Add-on beta');

    const amount = wrapper.get('[data-testid="price-amount"]').text();
    expect(amount).toContain('11.89');
  });

  it('renders the empty state when there are no addons', async () => {
    vi.mocked(api.get).mockResolvedValue({ addons: [] });
    const wrapper = mountWidget();
    await flushPromises();

    expect(wrapper.find('[data-testid="addon-catalog-empty"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="addon-card"]')).toHaveLength(0);
  });

  it('renders the error state when the fetch fails (graceful)', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('boom'));
    const wrapper = mountWidget();
    await flushPromises();

    expect(wrapper.find('[data-testid="addon-catalog-error"]').exists()).toBe(true);
  });
});
