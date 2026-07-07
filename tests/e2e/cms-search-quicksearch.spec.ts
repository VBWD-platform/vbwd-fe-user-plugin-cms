import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  loginAdmin,
  seedSearchFixtures,
  cleanupSearchFixtures,
  setDocsSearchConfig,
  SEARCH_TOKEN,
  type SearchFixtures,
} from './support/searchFixtures';

/**
 * S121 T7 — quicksearch dropdown journey on the demo "docs" layout.
 *
 * Drives the real fe-user render (E2E_BASE_URL=http://localhost:8080): typing in
 * the `Search` box on a docs-layout page shows a live dropdown scoped by config,
 * keyboard-navigable, published-only. Fixtures are seeded/cleaned via the admin
 * CMS API (self-cleaning, no raw SQL).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const SHOT_DIR = process.env.S121_SHOT_DIR;

let api: APIRequestContext;
let token: string;
let fixtures: SearchFixtures;

async function shot(page: import('@playwright/test').Page, name: string): Promise<void> {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: false });
}

const dropdown = '[data-testid="post-search-dropdown"]';
const option = '[data-testid="post-search-option"]';
const input = '[data-testid="post-search-input"]';

test.describe('S121 — CMS quicksearch dropdown (docs layout)', () => {
  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: BASE_URL });
    token = await loginAdmin(api);
    fixtures = await seedSearchFixtures(api, token);
  });

  test.afterAll(async () => {
    await cleanupSearchFixtures(api, token);
    await api.dispose();
  });

  test('typing shows a live dropdown of published page + post (scope=both), draft excluded', async ({ page }) => {
    await setDocsSearchConfig(api, token, fixtures, {
      quicksearch: true,
      scope: 'both',
      quicksearch_limit: 6,
    });
    await page.goto(`/${fixtures.docsHostSlug}`, { waitUntil: 'networkidle' });

    const box = page.locator(input).first();
    await expect(box).toHaveAttribute('role', 'combobox');

    await box.fill(SEARCH_TOKEN);
    await expect(page.locator(dropdown)).toBeVisible();

    const options = page.locator(option);
    await expect(options).toHaveCount(2);
    const texts = (await options.allInnerTexts()).join(' | ');
    expect(texts).toContain('Reference Page');
    expect(texts).toContain('Field Post');
    // Published-only: the draft (same token) must never surface.
    expect(texts).not.toContain('Hidden Draft');
    // Never more rows than the configured limit.
    expect(await options.count()).toBeLessThanOrEqual(6);

    await shot(page, '02-docs-quicksearch-both');
  });

  test('keyboard ↓/↑ + Enter opens the highlighted result', async ({ page }) => {
    await setDocsSearchConfig(api, token, fixtures, { quicksearch: true, scope: 'both', quicksearch_limit: 6 });
    await page.goto(`/${fixtures.docsHostSlug}`, { waitUntil: 'networkidle' });

    const box = page.locator(input).first();
    await box.fill(SEARCH_TOKEN);
    await expect(page.locator(dropdown)).toBeVisible();

    await box.press('ArrowDown');
    await expect(page.locator('.post-search__option--active')).toHaveCount(1);
    await box.press('ArrowDown');
    await box.press('ArrowUp');
    await expect(page.locator('.post-search__option--active')).toHaveCount(1);

    await box.press('Enter');
    // Enter on an active row navigates to that result's page.
    await expect(page).toHaveURL(/s121-e2e-(page|post)/);
  });

  test('Escape and click-out both close the dropdown', async ({ page }) => {
    await setDocsSearchConfig(api, token, fixtures, { quicksearch: true, scope: 'both', quicksearch_limit: 6 });
    await page.goto(`/${fixtures.docsHostSlug}`, { waitUntil: 'networkidle' });

    const box = page.locator(input).first();
    await box.fill(SEARCH_TOKEN);
    await expect(page.locator(dropdown)).toBeVisible();
    await box.press('Escape');
    await expect(page.locator(dropdown)).toHaveCount(0);

    // Reopen, then click outside the search widget → closes.
    await box.fill('');
    await box.fill(SEARCH_TOKEN);
    await expect(page.locator(dropdown)).toBeVisible();
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await expect(page.locator(dropdown)).toHaveCount(0);
  });

  test('scope=pages shows only pages; scope=posts only posts; draft never appears', async ({ page }) => {
    // pages
    await setDocsSearchConfig(api, token, fixtures, { quicksearch: true, scope: 'pages', quicksearch_limit: 6 });
    await page.goto(`/${fixtures.docsHostSlug}`, { waitUntil: 'networkidle' });
    let box = page.locator(input).first();
    await box.fill(SEARCH_TOKEN);
    await expect(page.locator(option)).toHaveCount(1);
    let texts = (await page.locator(option).allInnerTexts()).join(' | ');
    expect(texts).toContain('Reference Page');
    expect(texts).not.toContain('Field Post');
    expect(texts).not.toContain('Hidden Draft');
    await shot(page, '03a-docs-quicksearch-pages');

    // posts
    await setDocsSearchConfig(api, token, fixtures, { quicksearch: true, scope: 'posts', quicksearch_limit: 6 });
    await page.goto(`/${fixtures.docsHostSlug}`, { waitUntil: 'networkidle' });
    box = page.locator(input).first();
    await box.fill(SEARCH_TOKEN);
    await expect(page.locator(option)).toHaveCount(1);
    texts = (await page.locator(option).allInnerTexts()).join(' | ');
    expect(texts).toContain('Field Post');
    expect(texts).not.toContain('Reference Page');
    expect(texts).not.toContain('Hidden Draft');
    await shot(page, '03b-docs-quicksearch-posts');
  });

  test('quicksearch_limit caps the number of dropdown rows', async ({ page }) => {
    await setDocsSearchConfig(api, token, fixtures, { quicksearch: true, scope: 'both', quicksearch_limit: 1 });
    await page.goto(`/${fixtures.docsHostSlug}`, { waitUntil: 'networkidle' });
    const box = page.locator(input).first();
    await box.fill(SEARCH_TOKEN);
    await expect(page.locator(dropdown)).toBeVisible();
    await expect(page.locator(option)).toHaveCount(1);
  });
});
