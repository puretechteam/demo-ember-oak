// Shared quality checks: run on every page, both viewports.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const PAGES = ['/', '/404.html'];

for (const path of PAGES) {
  test.describe(`quality ${path}`, () => {
    test('no console errors or failed requests', async ({ page }) => {
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
      await page.goto(path, { waitUntil: 'networkidle' });
      expect(errors).toEqual([]);
    });

    test('no horizontal scroll', async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      // clientWidth, not innerWidth: on mobile emulation innerWidth grows to fit overflowing content.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      const offscreen = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        return [...document.querySelectorAll('header a, header button')]
          .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5); })
          .map((e) => (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 24));
      });
      expect(offscreen).toEqual([]);
    });

    for (const theme of ['light', 'dark']) {
      test(`axe: 0 violations (${theme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page.goto(path, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-visible')));
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        const summary = results.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')})`);
        expect(summary).toEqual([]);
      });
    }
  });
}

test('fits common phone widths: no overflow, header controls on screen', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone widths only');
  for (const width of [320, 360, 375, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      return {
        overflow: document.documentElement.scrollWidth - vw,
        offscreen: [...document.querySelectorAll('header a, header button')]
          .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > vw + 0.5 || b.left < -0.5); })
          .map((e) => (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 24)),
      };
    });
    expect(r, `at ${width}px`).toEqual({ overflow: 0, offscreen: [] });
  }
});

test('has title, description, canonical, og tags, JSON-LD', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
  for (const sel of ['meta[name="description"]', 'link[rel="canonical"]', 'meta[property="og:title"]', 'meta[property="og:image"]', 'link[rel="icon"]']) {
    await expect(page.locator(sel)).toHaveCount(1);
  }
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(() => JSON.parse(ld)).not.toThrow();
});

test('theme toggle switches and persists', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.locator('[data-theme-toggle]').first().click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
});

test('demo ribbon and Pure Tech credit present; ribbon dismisses and stays dismissed', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.pt-credit a')).toHaveAttribute('href', 'https://puretechteam.github.io/');
  const ribbon = page.locator('.demo-ribbon');
  await expect(ribbon).toBeVisible();
  await ribbon.getByRole('button').click();
  await expect(ribbon).toBeHidden();
  await page.reload();
  await expect(ribbon).toBeHidden();
});

test('same-site links and assets resolve, no root-absolute paths', async ({ page, request }) => {
  await page.goto('/');
  // Root-absolute paths ("/css/x.css") break under /<repo>/ on GitHub Pages.
  const rootAbs = await page.evaluate(() => [...document.querySelectorAll('[href^="/"]:not([href^="//"]), [src^="/"]:not([src^="//"])')].map((e) => e.outerHTML.slice(0, 80)));
  expect(rootAbs).toEqual([]);
  const urls = await page.evaluate(() => {
    const out = new Set();
    document.querySelectorAll('a[href], link[href], script[src], img[src], source[src]').forEach((el) => {
      const raw = el.getAttribute('href') || el.getAttribute('src');
      if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return;
      const u = new URL(raw, location.href);
      if (u.origin === location.origin) out.add(u.pathname);
    });
    return [...out];
  });
  for (const u of urls) {
    const res = await request.get(u);
    expect(res.status(), u).toBe(200);
  }
});
