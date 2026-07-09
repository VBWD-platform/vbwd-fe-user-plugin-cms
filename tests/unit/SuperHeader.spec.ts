import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// The rest of this file stubs PostSearch (see the top-of-file mock). This block
// instead exercises the REAL PostSearch so we prove the header's search box
// carries the submit button that PostSearch renders. We reset the module graph,
// un-mock PostSearch, and mock only its own collaborators (vue-router, usePosts).
describe('SuperHeader widget — search submit button (real PostSearch)', () => {
  beforeEach(() => {
    vi.resetModules();
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue(menuNavWidget());
    authenticatedState = false;
  });

  it('renders the PostSearch submit button inside the header search box', async () => {
    vi.doUnmock('../../src/components/PostSearch.vue');
    vi.doMock('vue-router', () => ({
      useRouter: () => ({ push: vi.fn() }),
      useRoute: () => ({ query: {}, path: '/' }),
    }));
    vi.doMock('../../src/composables/usePosts', () => ({
      usePosts: () => ({ bySearch: vi.fn().mockResolvedValue({ items: [] }) }),
    }));

    const { default: RealSuperHeader } = await import('../../src/components/SuperHeader.vue');
    const wrapper = mount(RealSuperHeader, { props: { config: { nav_widget_slug: '' } } });
    await flushPromises();

    const search = wrapper.find('.cms-super-header__search');
    expect(search.exists()).toBe(true);
    const button = search.find('[data-testid="post-search-submit"]');
    expect(button.exists()).toBe(true);
    expect(button.attributes('type')).toBe('submit');
    wrapper.unmount();
  });
});

describe('SuperHeader widget — auth link', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue(menuNavWidget());
    authenticatedState = false;
  });

  it('shows a login icon (not text) when unauthenticated', async () => {
    authenticatedState = false;
    const wrapper = await mountHeader({ nav_widget_slug: '' });
    const auth = wrapper.find('.cms-super-header__auth');
    const link = auth.find('[data-test-id="super-header-login-icon"]');
    expect(link.exists()).toBe(true);
    expect(link.classes()).toContain('cms-super-header__auth-link');
    expect(link.classes()).toContain('cms-super-header__auth-link--icon');
    expect(auth.findAll('svg')).toHaveLength(1);
    expect(link.text()).not.toContain('Login');
    expect(link.attributes('href')).toBe('/login');
    expect(link.attributes('aria-label')).toBe('Login');
    expect(link.attributes('title')).toBe('Login');
  });

  it('drives the login icon accessible name from login_label', async () => {
    authenticatedState = false;
    const wrapper = await mountHeader({ nav_widget_slug: '', login_label: 'Sign in' });
    const link = wrapper.find('[data-test-id="super-header-login-icon"]');
    expect(link.attributes('aria-label')).toBe('Sign in');
    expect(link.attributes('title')).toBe('Sign in');
  });

  it('honours a custom login_path on the icon anchor href', async () => {
    authenticatedState = false;
    const wrapper = await mountHeader({ nav_widget_slug: '', login_path: '/account/login' });
    const link = wrapper.find('[data-test-id="super-header-login-icon"]');
    expect(link.attributes('href')).toBe('/account/login');
  });

  it('shows a dashboard icon (not text) when authenticated', async () => {
    authenticatedState = true;
    const wrapper = await mountHeader({ nav_widget_slug: '' });
    const auth = wrapper.find('.cms-super-header__auth');
    const link = auth.find('[data-test-id="super-header-dashboard-icon"]');
    expect(link.exists()).toBe(true);
    expect(link.classes()).toContain('cms-super-header__auth-link');
    expect(link.classes()).toContain('cms-super-header__auth-link--icon');
    expect(auth.find('svg').exists()).toBe(true);
    expect(link.text()).not.toContain('Dashboard');
    expect(link.attributes('href')).toBe('/dashboard');
    expect(link.attributes('aria-label')).toBe('Dashboard');
    expect(link.attributes('title')).toBe('Dashboard');
  });

  it('drives the icon accessible name from dashboard_label', async () => {
    authenticatedState = true;
    const wrapper = await mountHeader({ nav_widget_slug: '', dashboard_label: 'My account' });
    const link = wrapper.find('[data-test-id="super-header-dashboard-icon"]');
    expect(link.attributes('aria-label')).toBe('My account');
    expect(link.attributes('title')).toBe('My account');
  });

  it('honours a custom dashboard_path on the icon anchor href', async () => {
    authenticatedState = true;
    const wrapper = await mountHeader({ nav_widget_slug: '', dashboard_path: '/account' });
    const link = wrapper.find('[data-test-id="super-header-dashboard-icon"]');
    expect(link.attributes('href')).toBe('/account');
  });

  it('omits the auth block entirely when show_auth_links is false (anonymous)', async () => {
    authenticatedState = false;
    const wrapper = await mountHeader({ nav_widget_slug: '', show_auth_links: false });
    expect(wrapper.find('.cms-super-header__auth').exists()).toBe(false);
  });

  it('omits the auth block entirely when show_auth_links is false (authenticated)', async () => {
    authenticatedState = true;
    const wrapper = await mountHeader({ nav_widget_slug: '', show_auth_links: false });
    expect(wrapper.find('.cms-super-header__auth').exists()).toBe(false);
  });
});

// The `stickable` feature attaches a passive, rAF-throttled scroll listener that
// pins the header once the visitor scrolls past a threshold. rAF is stubbed to
// run synchronously so a dispatched `scroll` resolves state within one tick, and
// `window.scrollY` is overridden per assertion.
describe('SuperHeader widget — stickable', () => {
  function setScrollY(value: number): void {
    Object.defineProperty(window, 'scrollY', { value, writable: true, configurable: true });
  }

  function stuck(wrapper: Awaited<ReturnType<typeof mountHeader>>): boolean {
    return wrapper.find('.cms-super-header').classes().includes('cms-super-header--stuck');
  }

  function spacerExists(wrapper: Awaited<ReturnType<typeof mountHeader>>): boolean {
    return wrapper.find('[data-test-id="super-header-spacer"]').exists();
  }

  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue(menuNavWidget());
    authenticatedState = false;
    setScrollY(0);
    // Run rAF synchronously so a dispatched `scroll` resolves the stuck state
    // within the same tick (no real frame to await).
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', (): void => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setScrollY(0);
  });

  it('adds no scroll listener and never sticks when stickable is absent/false', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const wrapper = await mountHeader({ nav_widget_slug: '' });

    const scrollCalls = addEventListenerSpy.mock.calls.filter((call) => call[0] === 'scroll');
    expect(scrollCalls).toHaveLength(0);

    setScrollY(9999);
    window.dispatchEvent(new Event('scroll'));
    await wrapper.vm.$nextTick();

    expect(stuck(wrapper)).toBe(false);
    expect(spacerExists(wrapper)).toBe(false);
    addEventListenerSpy.mockRestore();
  });

  it('registers a passive scroll listener and sticks past the default 160px offset', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const wrapper = await mountHeader({ nav_widget_slug: '', stickable: true });

    const scrollCalls = addEventListenerSpy.mock.calls.filter((call) => call[0] === 'scroll');
    expect(scrollCalls).toHaveLength(1);
    expect(scrollCalls[0][2]).toEqual({ passive: true });

    setScrollY(200);
    window.dispatchEvent(new Event('scroll'));
    await wrapper.vm.$nextTick();

    expect(stuck(wrapper)).toBe(true);
    expect(spacerExists(wrapper)).toBe(true);
    addEventListenerSpy.mockRestore();
  });

  it('un-sticks and drops the spacer when scrolled back to the top', async () => {
    const wrapper = await mountHeader({ nav_widget_slug: '', stickable: true });

    setScrollY(200);
    window.dispatchEvent(new Event('scroll'));
    await wrapper.vm.$nextTick();
    expect(stuck(wrapper)).toBe(true);

    setScrollY(0);
    window.dispatchEvent(new Event('scroll'));
    await wrapper.vm.$nextTick();
    expect(stuck(wrapper)).toBe(false);
    expect(spacerExists(wrapper)).toBe(false);
  });

  it('honours a custom stickable_offset_px threshold', async () => {
    const wrapper = await mountHeader({
      nav_widget_slug: '',
      stickable: true,
      stickable_offset_px: 40,
    });

    setScrollY(30);
    window.dispatchEvent(new Event('scroll'));
    await wrapper.vm.$nextTick();
    expect(stuck(wrapper)).toBe(false);

    setScrollY(50);
    window.dispatchEvent(new Event('scroll'));
    await wrapper.vm.$nextTick();
    expect(stuck(wrapper)).toBe(true);
  });

  it('falls back to the 160px default for a negative/non-finite offset', async () => {
    const wrapper = await mountHeader({
      nav_widget_slug: '',
      stickable: true,
      stickable_offset_px: -5,
    });

    // 100 <= 160 (the default) proves the negative offset was not applied — a
    // floor-to-0 bug would have stuck the header here.
    setScrollY(100);
    window.dispatchEvent(new Event('scroll'));
    await wrapper.vm.$nextTick();
    expect(stuck(wrapper)).toBe(false);

    setScrollY(200);
    window.dispatchEvent(new Event('scroll'));
    await wrapper.vm.$nextTick();
    expect(stuck(wrapper)).toBe(true);
  });

  it('removes the scroll listener on unmount when stickable', async () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const wrapper = await mountHeader({ nav_widget_slug: '', stickable: true });

    wrapper.unmount();

    const scrollRemovals = removeEventListenerSpy.mock.calls.filter((call) => call[0] === 'scroll');
    expect(scrollRemovals).toHaveLength(1);
    removeEventListenerSpy.mockRestore();
  });
});
