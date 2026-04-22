import { test, expect, request as apiRequest } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Theme contrast audit.
 *
 * For every CMS style in the DB, flip each target page's style_id to that
 * style, screenshot the result, and compute WCAG contrast ratios for a
 * handful of known elements. Writes a report markdown + per-(style,page)
 * screenshots.
 *
 *   API_BASE=http://localhost:8080 npx playwright test theme-contrast --reporter=list
 *
 * Pages covered: /home1, /home2, /accelerator, /theme-showcase.
 */

const API_BASE = process.env.API_BASE ?? 'http://localhost:8080';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'AdminPass123@';

const TARGETS = ['home1', 'home2', 'accelerator', 'theme-showcase'];
const OUT = path.join('test-results', 'theme-contrast');
fs.mkdirSync(OUT, { recursive: true });

const MIN_RATIO = 4.5; // WCAG AA for normal text

type StyleRow = { id: string; slug: string; name: string; is_active: boolean };
type PageRow = { id: string; slug: string; style_id: string | null };

async function login(ctx: any): Promise<string> {
  const r = await ctx.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const body = await r.json();
  return body.token || body.access_token;
}

async function loadStyles(ctx: any, token: string): Promise<StyleRow[]> {
  const r = await ctx.get(`${API_BASE}/api/v1/admin/cms/styles?per_page=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await r.json();
  return body.items.filter((s: StyleRow) => s.is_active);
}

async function loadPageIds(ctx: any, token: string): Promise<Record<string, PageRow>> {
  const r = await ctx.get(`${API_BASE}/api/v1/admin/cms/pages?per_page=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await r.json();
  const byId: Record<string, PageRow> = {};
  for (const p of body.items) {
    if (TARGETS.includes(p.slug)) byId[p.slug] = p;
  }
  return byId;
}

async function setPageStyle(ctx: any, token: string, pageId: string, styleId: string | null) {
  await ctx.put(`${API_BASE}/api/v1/admin/cms/pages/${pageId}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { style_id: styleId },
  });
}

// — WCAG ratio helpers (client-evaluated in the page) —
const CONTRAST_HELPERS = `
(function(){
  function parseRgb(s){ const m=s.match(/rgba?\\(([^)]+)\\)/); if(!m) return null; const p=m[1].split(',').map(x=>parseFloat(x.trim())); return [p[0],p[1],p[2],p[3]===undefined?1:p[3]]; }
  function lum(rgb){ const [r,g,b]=rgb.map(v=>{ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); }); return 0.2126*r+0.7152*g+0.0722*b; }
  function ratio(a,b){ const la=lum(a), lb=lum(b); return (Math.max(la,lb)+0.05)/(Math.min(la,lb)+0.05); }
  function effectiveBg(el){
    let cur=el;
    while(cur && cur!==document.documentElement){
      const s=getComputedStyle(cur);
      const bg=parseRgb(s.backgroundColor);
      if(bg && bg[3]>0.01) return bg;
      cur=cur.parentElement;
    }
    return [255,255,255,1];
  }
  window.__probes = function(selectors){
    return selectors.map(sel => {
      const el = document.querySelector(sel);
      if (!el) return { selector: sel, found: false };
      const fg = parseRgb(getComputedStyle(el).color);
      const bg = effectiveBg(el);
      const txt = (el.textContent || '').trim().slice(0,60);
      return {
        selector: sel, found: true, text: txt,
        fg: fg, bg: bg, ratio: +ratio(fg,bg).toFixed(2),
      };
    });
  };
})();
`;

type Probe = {
  selector: string;
  found: boolean;
  text?: string;
  fg?: number[];
  bg?: number[];
  ratio?: number;
};

const SELECTORS = [
  '.hero h1', '.hero p', '.hero .btn', '.hero .btn--accent', '.hero .btn--contrast',
  '.cta-band h2', '.cta-band p', '.cta-band .btn',
  '.card h3', '.card p', 'body',
];

test.describe.configure({ mode: 'serial' });

test('audit every theme × 4 pages', async ({ browser }) => {
  test.setTimeout(30 * 60 * 1000);

  const ctx = await apiRequest.newContext();
  const token = await login(ctx);
  const styles = await loadStyles(ctx, token);
  const pagesByslug = await loadPageIds(ctx, token);

  // Remember original style_ids so we can restore at end
  const originalStyles: Record<string, string | null> = {};
  for (const slug of TARGETS) {
    if (pagesByslug[slug]) originalStyles[slug] = pagesByslug[slug].style_id;
  }

  const rows: Array<{
    style: string; page: string; selector: string;
    found: boolean; text: string; fg: string; bg: string; ratio: number; ok: boolean;
  }> = [];

  try {
    for (const style of styles) {
      const styleDir = path.join(OUT, style.slug);
      fs.mkdirSync(styleDir, { recursive: true });

      for (const slug of TARGETS) {
        const page = pagesByslug[slug];
        if (!page) continue;

        await setPageStyle(ctx, token, page.id, style.id);

        const browserPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await browserPage.goto(`${API_BASE}/${slug}`, { waitUntil: 'networkidle' });
        await browserPage.waitForTimeout(500);
        await browserPage.evaluate(CONTRAST_HELPERS);
        const probes = (await browserPage.evaluate(
          (sels: string[]) => (window as any).__probes(sels),
          SELECTORS,
        )) as Probe[];

        await browserPage.screenshot({
          path: path.join(styleDir, `${slug}.png`),
          fullPage: true,
        });
        await browserPage.close();

        for (const p of probes) {
          rows.push({
            style: style.slug, page: slug, selector: p.selector,
            found: p.found, text: (p.text ?? '').replace(/\s+/g,' '),
            fg: p.fg ? `rgb(${p.fg.slice(0,3).join(',')})` : '',
            bg: p.bg ? `rgb(${p.bg.slice(0,3).join(',')})` : '',
            ratio: p.ratio ?? 0,
            ok: !p.found || (p.ratio ?? 0) >= MIN_RATIO,
          });
        }
      }
    }
  } finally {
    for (const slug of TARGETS) {
      const page = pagesByslug[slug];
      if (page) await setPageStyle(ctx, token, page.id, originalStyles[slug] ?? null);
    }
  }

  // Emit report
  const lines: string[] = [];
  lines.push('# Theme × page contrast audit\n');
  lines.push(`Minimum ratio = ${MIN_RATIO} (WCAG AA normal text)\n\n`);
  const fails = rows.filter(r => r.found && !r.ok);
  lines.push(`**${fails.length}** probe(s) below threshold out of **${rows.filter(r=>r.found).length}** measured.\n\n`);
  if (fails.length) {
    lines.push('## Failures\n\n| Theme | Page | Selector | Ratio | FG | BG | Snippet |\n|---|---|---|---|---|---|---|\n');
    for (const r of fails) {
      lines.push(`| ${r.style} | ${r.page} | \`${r.selector}\` | ${r.ratio} | ${r.fg} | ${r.bg} | ${r.text} |\n`);
    }
  }
  lines.push('\n## All probes\n\n| Theme | Page | Selector | Ratio | Pass |\n|---|---|---|---|---|\n');
  for (const r of rows) {
    if (!r.found) continue;
    lines.push(`| ${r.style} | ${r.page} | \`${r.selector}\` | ${r.ratio} | ${r.ok ? '✅' : '❌'} |\n`);
  }
  fs.writeFileSync(path.join(OUT, 'report.md'), lines.join(''));

  console.log(`\n[AUDIT] ${fails.length} contrast failures across ${styles.length} themes × ${TARGETS.length} pages`);
  console.log(`[AUDIT] Report: ${path.join(OUT, 'report.md')}`);
  console.log(`[AUDIT] Screenshots: ${OUT}/<slug>/`);

  // Soft expectation so CI can surface the report without abort-on-first
  expect.soft(fails.length, `see ${path.join(OUT, 'report.md')}`).toBe(0);
});
