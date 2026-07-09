import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import type { CmsWidgetData } from '../../src/stores/useCmsStore';

// The SuperHeader fetches its referenced nav widget through the shared api
// client and reads the logged-in state through the host `isAuthenticated`.
// Both are mocked so the widget renders deterministically with no network.
const apiGetMock = vi.fn();
let authenticatedState = false;
vi.mock('@/api', () => ({
  api: { get: (...args: unknown[]) => apiGetMock(...args) },
  isAuthenticated: () => authenticatedState,
}));

// PostSearch owns its own router/quicksearch behaviour (covered by its own
// spec). Here we stub it to a probe that echoes the derived config it receives,
// so we assert the SuperHeader wires the search config through — without pulling
// vue-router into this component's test. Declared inside the (hoisted) factory
// so it is defined before the mock is registered.
vi.mock('../../src/components/PostSearch.vue', () => ({
  default: defineComponent({
    name: 'PostSearch',
    props: { config: { type: Object, default: () => ({}) } },
    setup(props) {
      return () =>
        h('div', {
          class: 'post-search-stub',
          'data-placeholder': (props.config as Record<string, unknown>).placeholder,
          'data-limit': String((props.config as Record<string, unknown>).quicksearch_limit),
        });
    },
  }),
}));

import SuperHeader from '../../src/components/SuperHeader.vue';

function menuNavWidget(): CmsWidgetData {
  return {
    id: 'menu-nav',
    slug: 'header-nav',
    name: 'Header nav',
    widget_type: 'menu',
    content_json: null,
    source_css: null,
    config: null,
    menu_items: [
      {
        id: 'm1',
        parent_id: null,
        label: 'Products',
        url: '/products',
        page_slug: null,
        target: '_self',
        icon: null,
        sort_order: 0,
      },
    ],
  };
}

function superHeaderNavWidget(): CmsWidgetData {
  return {
    id: 'vue-nav',
    slug: 'header-nav',
    name: 'Recursive header',
    widget_type: 'vue-component',
    content_json: { component: 'SuperHeader' },
    source_css: null,
    config: null,
  };
}

async function mountHeader(config: Record<string, unknown> = {}) {
  const wrapper = mount(SuperHeader, { props: { config } });
  await flushPromises();
  return wrapper;
}

describe('SuperHeader widget — logo', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue(menuNavWidget());
    authenticatedState = false;
  });

  it('renders the logo text inside the logo anchor by default', async () => {
    const wrapper = await mountHeader({ logo_text: 'Acme', nav_widget_slug: '' });
    const logo = wrapper.find('.cms-super-header__logo');
    expect(logo.exists()).toBe(true);
    expect(logo.text()).toContain('Acme');
    expect(logo.find('img').exists()).toBe(false);
  });

  it('renders an <img> when logo_image_url is set (alt = logo_text)', async () => {
    const wrapper = await mountHeader({
      logo_image_url: 'https://cdn.test/logo.png',
      logo_text: 'Acme',
      nav_widget_slug: '',
    });
    const img = wrapper.find('.cms-super-header__logo img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe('https://cdn.test/logo.png');
    expect(img.attributes('alt')).toBe('Acme');
  });

  it('honours logo_link on the logo anchor href', async () => {
    const wrapper = await mountHeader({ logo_link: '/home', nav_widget_slug: '' });
    expect(wrapper.find('.cms-super-header__logo').attributes('href')).toBe('/home');
  });
});

describe('SuperHeader widget — nav', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue(menuNavWidget());
    authenticatedState = false;
  });

  it('fetches the referenced widget by slug on mount and renders its items', async () => {
    const wrapper = await mountHeader({ nav_widget_slug: 'header-nav' });
    expect(apiGetMock).toHaveBeenCalledWith('/cms/widgets/by-slug/header-nav');
    // The reused CmsWidgetRenderer menu branch renders the menu item label.
    expect(wrapper.find('.cms-super-header__nav').text()).toContain('Products');
  });

  it('makes no request and renders no nav when nav_widget_slug is empty', async () => {
    const wrapper = await mountHeader({ nav_widget_slug: '' });
    expect(apiGetMock).not.toHaveBeenCalled();
    expect(wrapper.find('.cms-super-header__nav').text()).toBe('');
  });

  it('swallows a rejected fetch without throwing and renders no nav', async () => {
    apiGetMock.mockRejectedValue(new Error('boom'));
    const wrapper = await mountHeader({ nav_widget_slug: 'header-nav' });
    expect(wrapper.find('.cms-super-header__nav').text()).toBe('');
  });

  it('guards against recursion when the referenced widget is a SuperHeader', async () => {
    apiGetMock.mockResolvedValue(superHeaderNavWidget());
    const wrapper = await mountHeader({ nav_widget_slug: 'header-nav' });
    expect(wrapper.find('.cms-super-header__nav').text()).toBe('');
  });
});

describe('SuperHeader widget — search', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue(menuNavWidget());
    authenticatedState = false;
  });

  it('renders the search box and passes the derived config through', async () => {
    const wrapper = await mountHeader({
      nav_widget_slug: '',
      show_search: true,
      search_placeholder: 'Find…',
      quicksearch_limit: 9,
    });
    const search = wrapper.find('.cms-super-header__search .post-search-stub');
    expect(search.exists()).toBe(true);
    expect(search.attributes('data-placeholder')).toBe('Find…');
    expect(search.attributes('data-limit')).toBe('9');
  });

  it('omits the search box when show_search is false', async () => {
    const wrapper = await mountHeader({ nav_widget_slug: '', show_search: false });
    expect(wrapper.find('.cms-super-header__search').exists()).toBe(false);
  });
});

describe('SuperHeader widget — auth link', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue(menuNavWidget());
    authenticatedState = false;
  });

  it('shows the login link when unauthenticated', async () => {
    authenticatedState = false;
    const wrapper = await mountHeader({ nav_widget_slug: '' });
    const link = wrapper.find('.cms-super-header__auth-link');
    expect(link.exists()).toBe(true);
    expect(link.text()).toBe('Login');
    expect(link.attributes('href')).toBe('/login');
  });

  it('shows the dashboard link when authenticated', async () => {
    authenticatedState = true;
    const wrapper = await mountHeader({ nav_widget_slug: '' });
    const link = wrapper.find('.cms-super-header__auth-link');
    expect(link.text()).toBe('Dashboard');
    expect(link.attributes('href')).toBe('/dashboard');
  });

  it('omits the auth block entirely when show_auth_links is false', async () => {
    const wrapper = await mountHeader({ nav_widget_slug: '', show_auth_links: false });
    expect(wrapper.find('.cms-super-header__auth').exists()).toBe(false);
  });
});
