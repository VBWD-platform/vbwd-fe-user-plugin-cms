/**
 * S47.3 — `usePosts`: the single fetch path for the public content frontend.
 *
 * Components (PostList/PostCard) do NOT fetch — sources call this composable and
 * pass the resulting summaries down, so every listing (term widget today,
 * search results in 47.4) shares one render path. Pagination state lives here.
 *
 * Endpoints (47.0 public reads + 47.4 search):
 *   - GET /cms/posts ?type=&term_type=&term_slug=&page=&per_page=  (paginated)
 *   - GET /cms/posts/<path:slug> ?type=                            (single)
 *   - GET /cms/search ?q=&type=&term_type=&term_slug=&page=&per_page=  (FTS)
 */
import { ref } from 'vue';
import { api } from '@/api';

export interface PostSummary {
  id: string;
  type: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  content_html?: string | null;
  content_json?: Record<string, unknown> | null;
  published_at?: string | null;
  author_id?: string | null;
  og_image_url?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  robots?: string | null;
  canonical_url?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  schema_json?: Record<string, unknown> | null;
  parent_id?: string | null;
  /** Ancestor chain (root→parent), used by PostDetail for breadcrumbs. */
  ancestors?: Array<{ slug: string; title: string }>;
  [key: string]: unknown;
}

interface PaginatedPosts {
  items: PostSummary[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

const DEFAULT_PER_PAGE = 20;

export function usePosts(options: { perPage?: number } = {}) {
  const perPage = options.perPage ?? DEFAULT_PER_PAGE;

  const items = ref<PostSummary[]>([]);
  const current = ref<PostSummary | null>(null);
  const loading = ref(false);
  const page = ref(1);
  const pages = ref(1);
  const total = ref(0);

  async function byTerm(
    type: string,
    termType: string,
    termSlug: string,
    pageNumber = 1,
  ): Promise<PaginatedPosts | null> {
    loading.value = true;
    try {
      const result = await api.get<PaginatedPosts>('/cms/posts', {
        params: {
          type,
          term_type: termType,
          term_slug: termSlug,
          page: pageNumber,
          per_page: perPage,
        },
      });
      items.value = result.items ?? [];
      page.value = result.page ?? pageNumber;
      pages.value = result.pages ?? 1;
      total.value = result.total ?? items.value.length;
      return result;
    } catch (error) {
      console.warn('[CMS] usePosts.byTerm failed', error);
      items.value = [];
      page.value = pageNumber;
      pages.value = 1;
      total.value = 0;
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function bySearch(
    query: string,
    pageNumber = 1,
    scope: { type?: string; termType?: string; termSlug?: string } = {},
  ): Promise<PaginatedPosts | null> {
    loading.value = true;
    try {
      const params: Record<string, unknown> = {
        q: query,
        page: pageNumber,
        per_page: perPage,
      };
      if (scope.type) params.type = scope.type;
      if (scope.termType) params.term_type = scope.termType;
      if (scope.termSlug) params.term_slug = scope.termSlug;

      const result = await api.get<PaginatedPosts>('/cms/search', { params });
      items.value = result.items ?? [];
      page.value = result.page ?? pageNumber;
      pages.value = result.pages ?? 1;
      total.value = result.total ?? items.value.length;
      return result;
    } catch (error) {
      console.warn('[CMS] usePosts.bySearch failed', error);
      items.value = [];
      page.value = pageNumber;
      pages.value = 1;
      total.value = 0;
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function bySlug(type: string, slug: string): Promise<PostSummary | null> {
    loading.value = true;
    try {
      const post = await api.get<PostSummary>(`/cms/posts/${slug}`, {
        params: { type },
      });
      current.value = post;
      return post;
    } catch (error) {
      console.warn('[CMS] usePosts.bySlug failed', error);
      current.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  }

  return { items, current, loading, page, pages, total, byTerm, bySearch, bySlug };
}
