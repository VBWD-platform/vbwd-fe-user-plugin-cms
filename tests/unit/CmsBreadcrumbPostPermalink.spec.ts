/**
 * A post rendered at a permalink like
 *   /blog/2026/uncategorized/how-saas-platforms-like-vbwd-make-your-business-life-easier
 * must build its breadcrumbs from the CMS store (the fetched post + its terms),
 * NOT by slicing the raw URL. The permalink pattern
 *   %root%/[%year%/]%category_path%/%slug%
 * contains segments (`blog`, `2026`) that have NO backing route, so they must
 * never become links. The only navigable crumbs are Home, the category term
 * archive, and the post itself (current, non-link).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, RouterLinkStub, type VueWrapper } from '@vue/test-utils';

const routePath = { value: '/blog/2026/uncategorized/how-saas-platforms-like-vbwd' };
const storeState: { currentPage: unknown; categories: unknown[] } = {
  currentPage: null,
  categories: [],
};

vi.mock('vue-router', () => ({
  useRoute: () => ({ get path() { return routePath.value; } }),
}));

vi.mock('../../src/stores/useCmsStore', () => ({
  useCmsStore: () => storeState,
}));

import CmsBreadcrumb from '../../src/components/CmsBreadcrumb.vue';

const mountedWrappers: VueWrapper[] = [];

function mountBreadcrumb() {
  const wrapper = mount(CmsBreadcrumb, {
    global: { stubs: { RouterLink: RouterLinkStub } },
  });
  mountedWrappers.push(wrapper);
  return wrapper;
}

function linkTargets(wrapper: VueWrapper): string[] {
  return wrapper
    .findAllComponents(RouterLinkStub)
    .map((link) => String(link.props('to')));
}

describe('CmsBreadcrumb — post permalink (store-driven)', () => {
  beforeEach(() => {
    routePath.value =
      '/blog/2026/uncategorized/how-saas-platforms-like-vbwd';
    storeState.currentPage = null;
    storeState.categories = [];
  });

  afterEach(() => {
    while (mountedWrappers.length) mountedWrappers.pop()?.unmount();
  });

  it('builds Home + category archive + current title from the store; never links a non-resolving prefix', () => {
    storeState.currentPage = {
      type: 'post',
      title: 'How Saas Platforms Like Vbwd Make Your Business Life Easier',
      primary_term_id: 't1',
      terms: [
        {
          id: 't1',
          term_type: 'category',
          slug: 'uncategorized',
          name: 'Uncategorized',
          archive_url: 'category/uncategorized',
        },
      ],
    };

    const wrapper = mountBreadcrumb();
    const targets = linkTargets(wrapper);

    // Exactly two links: Home and the category term archive.
    expect(targets).toEqual(['/', '/category/uncategorized']);

    // The last (current) crumb is the post title, rendered as a non-link.
    expect(wrapper.find('.cms-breadcrumb__current').text()).toBe(
      'How Saas Platforms Like Vbwd Make Your Business Life Easier',
    );

    // No link points at a non-resolving permalink prefix.
    expect(targets).not.toContain('/blog/2026');
    expect(targets).not.toContain('/blog/2026/uncategorized');
    expect(targets.some((t) => t.startsWith('/blog/'))).toBe(false);
  });

  it('drops year/root entirely when the post has no category term (Home + title only)', () => {
    storeState.currentPage = {
      type: 'post',
      title: 'Uncategorised Post',
      primary_term_id: null,
      terms: [],
    };

    const wrapper = mountBreadcrumb();
    const targets = linkTargets(wrapper);

    expect(targets).toEqual(['/']);
    expect(wrapper.find('.cms-breadcrumb__current').text()).toBe(
      'Uncategorised Post',
    );
    expect(targets.some((t) => t.startsWith('/blog/'))).toBe(false);
  });

  it('picks the category matching primary_term_id when multiple category terms exist', () => {
    storeState.currentPage = {
      type: 'post',
      title: 'Multi-category Post',
      primary_term_id: 't2',
      terms: [
        {
          id: 't1',
          term_type: 'category',
          slug: 'news',
          name: 'News',
          archive_url: 'category/news',
        },
        {
          id: 't2',
          term_type: 'category',
          slug: 'guides',
          name: 'Guides',
          archive_url: 'category/guides',
        },
      ],
    };

    const wrapper = mountBreadcrumb();
    const targets = linkTargets(wrapper);

    expect(targets).toEqual(['/', '/category/guides']);
    expect(wrapper.findAllComponents(RouterLinkStub)[1].text()).toBe('Guides');
  });

  it('falls back to Home + single current crumb (no /blog links) on a multi-segment route with no store post', () => {
    storeState.currentPage = null;

    const wrapper = mountBreadcrumb();
    const targets = linkTargets(wrapper);

    // Only Home is a link; the last segment renders as the current crumb.
    expect(targets).toEqual(['/']);
    expect(wrapper.find('.cms-breadcrumb__current').text()).toBe(
      'How Saas Platforms Like Vbwd',
    );
    expect(targets.some((t) => t.includes('/blog/2026'))).toBe(false);
  });
});
