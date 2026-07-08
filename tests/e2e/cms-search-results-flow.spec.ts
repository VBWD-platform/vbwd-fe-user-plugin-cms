import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  loginAdmin,
  seedSearchFixtures,
  cleanupSearchFixtures,
  SEARCH_TOKEN,
} from './support/searchFixtures';

/**
 * S121 T7 — classic search flow on the seeded demo "search" layout.
 *
 * The decoupled `Search` box writes `?q=` and the `SearchResults` widget below
 * reads it and renders matches. Covers: box → /search?q=… → results, the
 * empty-query prompt, and the no-results state. Fixtures seeded/cleaned via the
 * admin CMS API (self-cleaning, no raw SQL).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const SHOT_DIR = process.env.S121_SHOT_DIR;

let api: APIRequestContext;
let token: string;

async function shot(page: import('@playwright/test').Page, name: string): Promise<void> {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: false });
}

const box = '[data-testid="post-search-input"]';
const emptyPrompt = '[data-testid="search-empty-query"]';
const noResults = '[data-testid="search-no-results"]';
const resultCard = '[data-testid="post-card"]';

// The SearchResults widget renders its terminal state (matches / no-results)
// only after the FTS request resolves, which can be slow under load — wait
// generously rather than on the default 5 s so the specs are not flaky.
const SETTLE_TIMEOUT = 20_000;

function searchResponse(page: import('@playwright/test').Page) {
  return page.waitForResponse(
    (response) => response.url().includes('/api/v1/cms/search') && response.status() === 200,
    { timeout: SETTLE_TIMEOUT },
  );
}

test.describe('S121 — CMS classic search results flow (search layout)', () => {
  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: BASE_URL });
    token = await loginAdmin(api);
    await seedSearchFixtures(api, token);
  });

  test.afterAll(async () => {
    await cleanupSearchFixtures(api, token);
    await api.dispose();
  });

  test('empty query shows the prompt', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'networkidle' });
    await expect(page.locator(emptyPrompt)).toBeVisible();
    await shot(page, '05a-search-empty-prompt');
  });

  test('box submit navigates to /search?q=… and SearchResults renders matches', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'networkidle' });

    const settled = searchResponse(page);
    await page.locator(box).first().fill(SEARCH_TOKEN);
    await page.locator(box).first().press('Enter');

    await expect(page).toHaveURL(new RegExp(`/search\\?q=${SEARCH_TOKEN}`));
    await settled;
    // scope=both on the seeded results widget → published page + post match.
    await expect(page.locator(resultCard).first()).toBeVisible({ timeout: SETTLE_TIMEOUT });
    const cardText = (await page.locator(resultCard).allInnerTexts()).join(' | ');
    expect(cardText).toContain('Reference Page');
    expect(cardText).toContain('Field Post');
    // Draft with the same token is excluded server-side.
    expect(cardText).not.toContain('Hidden Draft');
    await shot(page, '04-search-results-flow');
  });

  test('no-results state renders for a non-matching query', async ({ page }) => {
    const settled = searchResponse(page);
    await page.goto('/search?q=zzznotarealtermzzz', { waitUntil: 'networkidle' });
    await settled.catch(() => undefined);
    await expect(page.locator(noResults)).toBeVisible({ timeout: SETTLE_TIMEOUT });
    await shot(page, '05b-search-no-results');
  });
});
