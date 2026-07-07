/**
 * S121 — shared E2E fixtures for the CMS search journeys (quicksearch + results
 * flow). Everything is seeded through the admin CMS API (NO raw SQL) and torn
 * down again, so the specs are self-cleaning per the sprint DoD.
 *
 * The fixtures create a distinct published page, a published post and an
 * unpublished (draft) page — all carrying the same unique FTS token so a single
 * query returns exactly the published page + post while the draft is filtered
 * out server-side. A dedicated "docs" host page places the `Search` box widget
 * (quicksearch on) so the quicksearch dropdown can be driven on a real render.
 */
import type { APIRequestContext } from '@playwright/test';

/** Unique, non-word token so the FTS query only ever matches our fixtures. */
export const SEARCH_TOKEN = 'quicksleuth';

export const FIXTURE_SLUGS = {
  page: 's121-e2e-page',
  post: 's121-e2e-post',
  draft: 's121-e2e-draft',
  docsHost: 's121-e2e-docs-host',
} as const;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'AdminPass123@';

export interface SearchFixtures {
  token: string;
  pageId: string;
  postId: string;
  draftId: string;
  docsHostId: string;
  docsHostSlug: string;
  searchWidgetId: string;
}

export async function loginAdmin(request: APIRequestContext): Promise<string> {
  const response = await request.post('/api/v1/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!response.ok()) {
    throw new Error(`admin login failed: ${response.status()} ${await response.text()}`);
  }
  const body = await response.json();
  const token = body.token ?? body.access_token;
  if (!token) throw new Error('admin login returned no token');
  return token;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function docBody(text: string): Record<string, unknown> {
  return {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text }] },
    ],
  };
}

async function findWidgetIdBySlug(
  request: APIRequestContext,
  token: string,
  slug: string,
): Promise<string> {
  const response = await request.get('/api/v1/admin/cms/widgets?per_page=200', {
    headers: authHeaders(token),
  });
  const body = await response.json();
  const items = Array.isArray(body) ? body : body.items ?? [];
  const match = items.find((widget: { slug?: string }) => widget.slug === slug);
  if (!match) throw new Error(`widget '${slug}' not found`);
  return match.id;
}

async function findLayoutIdBySlug(
  request: APIRequestContext,
  token: string,
  slug: string,
): Promise<string> {
  const response = await request.get('/api/v1/admin/cms/layouts?per_page=200', {
    headers: authHeaders(token),
  });
  const body = await response.json();
  const items = Array.isArray(body) ? body : body.items ?? [];
  const match = items.find((layout: { slug?: string }) => layout.slug === slug);
  if (!match) throw new Error(`layout '${slug}' not found`);
  return match.id;
}

async function deletePostBySlugIfPresent(
  request: APIRequestContext,
  token: string,
  slug: string,
): Promise<void> {
  const response = await request.get(
    `/api/v1/admin/cms/posts?per_page=200&search=${encodeURIComponent(slug)}`,
    { headers: authHeaders(token) },
  );
  if (!response.ok()) return;
  const body = await response.json();
  const items = body.items ?? [];
  for (const post of items) {
    if (post.slug === slug) {
      await request.delete(`/api/v1/admin/cms/posts/${post.id}`, {
        headers: authHeaders(token),
      });
    }
  }
}

async function createPost(
  request: APIRequestContext,
  token: string,
  data: Record<string, unknown>,
): Promise<string> {
  const response = await request.post('/api/v1/admin/cms/posts', {
    headers: authHeaders(token),
    data,
  });
  if (!response.ok()) {
    throw new Error(`create post failed: ${response.status()} ${await response.text()}`);
  }
  const body = await response.json();
  return body.id;
}

/**
 * Place the `Search` box widget in the docs host page's `sidebar` area with the
 * given quicksearch config. The override is nested under `config` — the shape
 * the fe-user layout renderer merges over a vue-component widget's own config.
 */
export async function setDocsSearchConfig(
  request: APIRequestContext,
  token: string,
  fixtures: SearchFixtures,
  config: { quicksearch: boolean; scope: 'pages' | 'posts' | 'both'; quicksearch_limit?: number },
): Promise<void> {
  const response = await request.put(
    `/api/v1/admin/cms/posts/${fixtures.docsHostId}/widgets`,
    {
      headers: authHeaders(token),
      data: [
        {
          widget_id: fixtures.searchWidgetId,
          area_name: 'sidebar',
          sort_order: 0,
          config_override: { config },
        },
      ],
    },
  );
  if (!response.ok()) {
    throw new Error(`set docs search config failed: ${response.status()} ${await response.text()}`);
  }
}

export async function seedSearchFixtures(
  request: APIRequestContext,
  token: string,
): Promise<SearchFixtures> {
  const searchWidgetId = await findWidgetIdBySlug(request, token, 'search');
  const docsLayoutId = await findLayoutIdBySlug(request, token, 'docs');

  for (const slug of Object.values(FIXTURE_SLUGS)) {
    await deletePostBySlugIfPresent(request, token, slug);
  }

  const pageId = await createPost(request, token, {
    type: 'page',
    slug: FIXTURE_SLUGS.page,
    title: `${SEARCH_TOKEN} Reference Page`,
    status: 'published',
    content_json: docBody(`${SEARCH_TOKEN} reference page body`),
  });
  const postId = await createPost(request, token, {
    type: 'post',
    slug: FIXTURE_SLUGS.post,
    title: `${SEARCH_TOKEN} Field Post`,
    status: 'published',
    content_json: docBody(`${SEARCH_TOKEN} field post body`),
  });
  const draftId = await createPost(request, token, {
    type: 'page',
    slug: FIXTURE_SLUGS.draft,
    title: `${SEARCH_TOKEN} Hidden Draft`,
    status: 'draft',
    content_json: docBody(`${SEARCH_TOKEN} hidden draft body`),
  });
  const docsHostId = await createPost(request, token, {
    type: 'page',
    slug: FIXTURE_SLUGS.docsHost,
    title: 'S121 Docs Host',
    status: 'published',
    layout_id: docsLayoutId,
    content_json: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Docs Host' }] },
      ],
    },
  });
  // Some backends resolve layout only via update — set it explicitly to be safe.
  await request.put(`/api/v1/admin/cms/posts/${docsHostId}`, {
    headers: authHeaders(token),
    data: { layout_id: docsLayoutId },
  });

  const fixtures: SearchFixtures = {
    token: SEARCH_TOKEN,
    pageId,
    postId,
    draftId,
    docsHostId,
    docsHostSlug: FIXTURE_SLUGS.docsHost,
    searchWidgetId,
  };

  await setDocsSearchConfig(request, token, fixtures, {
    quicksearch: true,
    scope: 'both',
    quicksearch_limit: 6,
  });

  return fixtures;
}

export async function cleanupSearchFixtures(
  request: APIRequestContext,
  token: string,
): Promise<void> {
  for (const slug of Object.values(FIXTURE_SLUGS)) {
    await deletePostBySlugIfPresent(request, token, slug);
  }
}
