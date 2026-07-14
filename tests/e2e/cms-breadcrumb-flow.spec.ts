import { test, expect, type Page } from '@playwright/test';

/**
 * WordPress-style CMS breadcrumb journey (permalink-prefix archives).
 *
 * Drives the real fe-user render (E2E_BASE_URL=http://localhost:8080). The CMS
 * breadcrumb PROVIDER (registered via fe-core's `registerBreadcrumbProvider`
 * seam) builds a trail from the permalink prefix, and the rewired
 * `CmsBreadcrumb` widget renders fe-core's `VbwdBreadcrumb`. Every intermediate
 * prefix is a link to a catch-all prefix-ARCHIVE (`GET /api/v1/cms/archive/…`),
 * so clicking a crumb lands on a real post listing rather than a 404.
 *
 * Fixture: published blog posts under the `blog/2026/vbwd/…` permalink tree
 * (12 posts under `blog/2026`, 10 under `blog/2026/vbwd`).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';

const POST_PATH = '/blog/2026/vbwd/drop-a-file-plugin-model-without-touching-core';
const POST_TITLE = "Add a Feature Without Touching Core: VBWD's Drop-a-File Plugin Model";

const NAV = 'nav.vbwd-breadcrumb';
const LINK = '.vbwd-breadcrumb__link';
const CURRENT = '.vbwd-breadcrumb__current';
const POST_CARD = '[data-testid="post-card"]';

async function dismissConsent(page: Page): Promise<void> {
  // A cookie-consent backdrop intercepts pointer events until a choice is made.
  const accept = page.locator('[data-testid="cookie-accept-all"]');
  if (await accept.count()) {
    await accept.first().click().catch(() => undefined);
    await page
      .locator('[data-testid="cookie-consent-backdrop"]')
      .waitFor({ state: 'hidden', timeout: 5_000 })
      .catch(() => undefined);
  }
}

async function waitForBreadcrumb(page: Page): Promise<void> {
  await page.locator(NAV).first().waitFor({ state: 'visible', timeout: 20_000 });
  // The last crumb (current label) is populated once the provider resolves.
  await expect(page.locator(`${NAV} ${CURRENT}`).first()).toBeVisible({ timeout: 20_000 });
}

/** Ordered [label, href|null] pairs for every crumb in the breadcrumb nav. */
async function readCrumbs(page: Page): Promise<Array<[string, string | null]>> {
  return page.locator(`${NAV} > a, ${NAV} > span.vbwd-breadcrumb__current`).evaluateAll((nodes) =>
    nodes.map((n) => [
      (n.textContent ?? '').trim(),
      n.tagName.toLowerCase() === 'a' ? n.getAttribute('href') : null,
    ] as [string, string | null]),
  );
}

test.describe('CMS breadcrumb — WordPress-style prefix archives', () => {
  test('post page shows full linked trail; last crumb is current', async ({ page }) => {
    await page.goto(BASE_URL + POST_PATH, { waitUntil: 'domcontentloaded' });
    await waitForBreadcrumb(page);

    const crumbs = await readCrumbs(page);
    const labels = crumbs.map((c) => c[0]);

    // Home, Blog, 2026, Vbwd, <post title> — five crumbs in order.
    expect(labels.slice(0, 4)).toEqual(['Home', 'Blog', '2026', 'Vbwd']);
    expect(labels).toHaveLength(5);

    // Intermediate crumbs are links to their prefix.
    expect(crumbs[0]).toEqual(['Home', '/']);
    expect(crumbs[1]).toEqual(['Blog', '/blog']);
    expect(crumbs[2]).toEqual(['2026', '/blog/2026']);
    expect(crumbs[3]).toEqual(['Vbwd', '/blog/2026/vbwd']);

    // Last crumb is the current post title (label may be truncated with an
    // ellipsis by VbwdBreadcrumb.maxLabelLength) and is NOT a link.
    const [lastLabel, lastHref] = crumbs[4];
    expect(lastHref).toBeNull();
    const stripped = lastLabel.replace(/…$/, '');
    expect(POST_TITLE.startsWith(stripped)).toBe(true);
    expect(await page.locator(`${NAV} ${CURRENT}`).count()).toBe(1);
  });

  test('clicking "2026" opens the prefix archive listing', async ({ page }) => {
    await page.goto(BASE_URL + POST_PATH, { waitUntil: 'domcontentloaded' });
    await waitForBreadcrumb(page);
    await dismissConsent(page);

    await page.locator(`${NAV} a`, { hasText: /^2026$/ }).click();
    await page.waitForURL('**/blog/2026', { timeout: 20_000 });

    // Archive renders a post list, not a not-found state.
    await expect(page.locator(POST_CARD).first()).toBeVisible({ timeout: 20_000 });
    expect(await page.locator(POST_CARD).count()).toBeGreaterThan(0);
    expect(await page.getByText(/not found|404/i).count()).toBe(0);

    // Breadcrumb on the archive: Home / Blog / 2026 with 2026 the current crumb.
    const crumbs = await readCrumbs(page);
    expect(crumbs.map((c) => c[0])).toEqual(['Home', 'Blog', '2026']);
    expect(crumbs[0]).toEqual(['Home', '/']);
    expect(crumbs[1]).toEqual(['Blog', '/blog']);
    expect(crumbs[2][1]).toBeNull(); // 2026 is current (non-link)
  });

  test('clicking "Vbwd" opens the deeper prefix archive listing', async ({ page }) => {
    await page.goto(BASE_URL + POST_PATH, { waitUntil: 'domcontentloaded' });
    await waitForBreadcrumb(page);
    await dismissConsent(page);

    await page.locator(`${NAV} a`, { hasText: /^Vbwd$/ }).click();
    await page.waitForURL('**/blog/2026/vbwd', { timeout: 20_000 });

    await expect(page.locator(POST_CARD).first()).toBeVisible({ timeout: 20_000 });
    expect(await page.locator(POST_CARD).count()).toBeGreaterThan(0);
    expect(await page.getByText(/not found|404/i).count()).toBe(0);

    const crumbs = await readCrumbs(page);
    expect(crumbs.map((c) => c[0])).toEqual(['Home', 'Blog', '2026', 'Vbwd']);
    expect(crumbs[2]).toEqual(['2026', '/blog/2026']);
    expect(crumbs[3][1]).toBeNull(); // Vbwd is current (non-link)
  });

  test('archive /blog/2026 loaded directly shows current "2026" crumb', async ({ page }) => {
    await page.goto(BASE_URL + '/blog/2026', { waitUntil: 'domcontentloaded' });
    await waitForBreadcrumb(page);

    const crumbs = await readCrumbs(page);
    expect(crumbs.map((c) => c[0])).toEqual(['Home', 'Blog', '2026']);
    expect(crumbs[2][1]).toBeNull();
    await expect(page.locator(POST_CARD).first()).toBeVisible({ timeout: 20_000 });
  });
});
