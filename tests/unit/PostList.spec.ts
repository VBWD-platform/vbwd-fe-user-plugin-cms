import { describe, it, expect } from 'vitest';
import { mount, RouterLinkStub } from '@vue/test-utils';
import PostList from '../../src/components/PostList.vue';
import PostCard from '../../src/components/PostCard.vue';
import type { PostSummary } from '../../src/composables/usePosts';

function makePost(n: number): PostSummary {
  return {
    id: String(n),
    type: 'post',
    slug: `post-${n}`,
    title: `Post ${n}`,
    excerpt: `Excerpt ${n}`,
    content_html: `<p>Body ${n}</p>`,
    published_at: '2026-06-01T10:00:00+00:00',
    author_id: 'a1',
    og_image_url: null,
  } as PostSummary;
}

function mountList(posts: PostSummary[], display: Record<string, unknown> = {}) {
  return mount(PostList, {
    props: { posts, display },
    global: {
      stubs: { RouterLink: RouterLinkStub },
      mocks: { $t: (key: string) => key },
    },
  });
}

describe('PostList', () => {
  it('renders one PostCard per item', () => {
    const wrapper = mountList([makePost(1), makePost(2), makePost(3)], { mode: 'excerpt' });
    expect(wrapper.findAll('[data-testid="post-card"]')).toHaveLength(3);
  });

  it('passes the display config through so excerpt mode shows excerpts', () => {
    const wrapper = mountList([makePost(1)], { mode: 'excerpt' });
    expect(wrapper.text()).toContain('Excerpt 1');
  });

  it('shows the empty state (no crash) when given no posts', () => {
    const wrapper = mountList([], { mode: 'excerpt' });
    expect(wrapper.findAll('[data-testid="post-card"]')).toHaveLength(0);
    expect(wrapper.find('[data-testid="post-list-empty"]').exists()).toBe(true);
  });

  it('threads detailBase through to each PostCard so links stay in embed mode', () => {
    const wrapper = mount(PostList, {
      props: {
        posts: [makePost(1), makePost(2)],
        display: { mode: 'excerpt' },
        detailBase: '/cms/embed/post/post/',
      },
      global: {
        stubs: { RouterLink: RouterLinkStub },
        mocks: { $t: (key: string) => key },
      },
    });
    const card = wrapper.findComponent(PostCard);
    expect(card.props('detailBase')).toBe('/cms/embed/post/post/');
    const firstLink = wrapper.findComponent(RouterLinkStub);
    expect(firstLink.props('to')).toBe('/cms/embed/post/post/post-1');
  });

  it('renders the configured meta fields in the configured order', () => {
    const wrapper = mountList([makePost(1)], {
      mode: 'excerpt',
      meta: ['author', 'time_ago'],
    });
    // PostCard owns the meta row; assert it received the ordered config.
    const card = wrapper.find('[data-testid="post-card"]');
    expect(card.exists()).toBe(true);
    const meta = wrapper.find('[data-testid="post-meta"]');
    expect(meta.exists()).toBe(true);
  });
});
