// Feature checks for Ember & Oak: menu, tasting builder, reservations, hours badge, gallery, nav, hero.
const { test, expect } = require('@playwright/test');

// Restaurant time zone is America/Los_Angeles (PST, UTC-8 in November).
const at = (iso) => new Date(iso);

test.beforeEach(async ({ page }) => {
  // Keep the demo ribbon out of the way of clicks near the bottom edge.
  await page.addInitScript(() => { try { localStorage.setItem('emberoak:ribbon', '1'); } catch (e) { /* ignore */ } });
});

test.describe('menu filters and search', () => {
  test('chips filter, combine, announce counts and clear', async ({ page }) => {
    await page.goto('/');
    const count = page.locator('[data-menu-count]');
    const visible = page.locator('[data-menu] .dish:not([hidden])');
    await expect(count).toHaveText('Showing all 16 dishes');
    await expect(count).toHaveAttribute('aria-live', 'polite');

    const vegan = page.locator('[data-filter="vegan"]');
    await vegan.click();
    await expect(vegan).toHaveAttribute('aria-pressed', 'true');
    await expect(count).toHaveText('Showing 4 of 16 dishes');
    await expect(visible).toHaveCount(4);

    await page.locator('[data-filter="spicy"]').click();
    await expect(count).toHaveText('Showing 2 of 16 dishes');
    await expect(visible).toHaveCount(2);
    // Empty sections hide with their dishes.
    await expect(page.locator('[data-menu-section]:not([hidden])')).toHaveCount(2);

    await page.locator('.chip-clear').click();
    await expect(vegan).toHaveAttribute('aria-pressed', 'false');
    await expect(count).toHaveText('Showing all 16 dishes');

    await page.locator('[data-filter="vegetarian"]').click();
    await expect(count).toHaveText('Showing 10 of 16 dishes');
    await page.locator('[data-filter="vegetarian"]').click();
    await page.locator('[data-filter="gluten-free"]').click();
    await expect(count).toHaveText('Showing 10 of 16 dishes');
  });

  test('text search narrows results and shows an empty state', async ({ page }) => {
    await page.goto('/');
    const search = page.getByLabel('Search the menu');
    const count = page.locator('[data-menu-count]');
    await search.fill('honey');
    await expect(count).toHaveText('Showing 1 of 16 dishes');
    await expect(page.locator('.dish:not([hidden]) .dish-name')).toHaveText(['Ember-roasted beets']);

    await search.fill('wagyu tartare');
    await expect(count).toHaveText('No dishes match');
    const empty = page.locator('[data-menu-empty]');
    await expect(empty).toBeVisible();
    await empty.getByRole('button', { name: 'Show the whole menu' }).click();
    await expect(empty).toBeHidden();
    await expect(search).toHaveValue('');
    await expect(count).toHaveText('Showing all 16 dishes');
  });
});

test.describe('tasting menu builder', () => {
  test('running totals, party stepper and pairing changes', async ({ page }) => {
    await page.goto('/');
    const per = page.locator('[data-per-person]');
    const table = page.locator('[data-table-total]');
    const wine = page.locator('[data-pairing-name]');
    await expect(per).toHaveText('$0');
    await expect(wine).toHaveText('Choose something from the fire');

    const pick = (course, id) => page.locator(`[data-course="${course}"] input[value="${id}"]`).check();
    await pick('small', 'beets');
    await pick('fire', 'ribeye');
    await pick('side', 'potatoes');
    await pick('sweet', 'cheesecake');
    await expect(per).toHaveText('$90');
    await expect(table).toHaveText('$180');
    await expect(wine).toContainText('Syrah');
    await expect(page.locator('[data-pours]')).toContainText('tawny port');
    await expect(page.locator('[data-pick="fire"] .pick-name')).toHaveText('Dry-aged ribeye, 14 oz');

    await pick('fire', 'branzino');
    await expect(wine).toContainText('Albariño');
    await expect(per).toHaveText('$74');
    await expect(table).toHaveText('$148');

    await page.getByRole('button', { name: 'Add a guest' }).click();
    await expect(page.locator('[data-party]')).toHaveText('3');
    await expect(table).toHaveText('$222');

    await page.locator('[data-pairing-add]').check();
    await expect(per).toHaveText('$112');
    await expect(table).toHaveText('$336');

    // Two spicy picks swap the main pour for something off-dry.
    await pick('small', 'padron');
    await pick('fire', 'chicken');
    await expect(wine).toContainText('Riesling');

    // Stepper respects its bounds.
    const minus = page.getByRole('button', { name: 'Remove a guest' });
    for (let i = 0; i < 3; i++) if (await minus.isEnabled()) await minus.click();
    await expect(page.locator('[data-party]')).toHaveText('1');
    await expect(minus).toBeDisabled();
  });

  test('reserve link carries the party size into the booking form', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Add a guest' }).click();
    await page.getByRole('button', { name: 'Add a guest' }).click();
    await page.locator('[data-book-tasting]').click();
    await expect(page.locator('#res-party')).toHaveValue('4');
  });
});

test.describe('reservations', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: at('2026-11-18T10:00:00-08:00') }); // Wednesday morning
    await page.goto('/');
  });

  test('date bounds, Monday rejection and seeded slots', async ({ page }) => {
    const date = page.locator('#res-date');
    await expect(date).toHaveAttribute('min', '2026-11-18');
    await expect(date).toHaveAttribute('max', '2027-01-17');

    await date.fill('2026-11-23'); // Monday
    await expect(page.locator('#res-date-err')).toContainText('closed on Mondays');
    await expect(date).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('[data-slots] input')).toHaveCount(0);

    await date.fill('2026-11-20'); // Friday: 5 pm to 11 pm, last seating 9:45
    await expect(page.locator('#res-date-err')).toHaveText('');
    const slots = page.locator('[data-slots] input[name="time"]');
    await expect(slots).toHaveCount(20);
    const booked = await page.locator('[data-slots] input:disabled').evaluateAll((els) => els.map((e) => e.value));
    expect(booked.length).toBeGreaterThan(0);
    expect(booked.length).toBeLessThan(20);
    await expect(page.locator('[data-slots-status]')).toContainText('Friday, November 20');

    // Same date, same booked slots.
    await date.fill('2026-11-21');
    await date.fill('2026-11-20');
    const again = await page.locator('[data-slots] input:disabled').evaluateAll((els) => els.map((e) => e.value));
    expect(again).toEqual(booked);

    await date.fill('2026-11-22'); // Sunday: 4 pm to 9 pm
    await expect(slots).toHaveCount(16);
    await expect(page.locator('[data-slots] label').first()).toContainText('4:00');

    await date.fill('2027-03-01');
    await expect(page.locator('#res-date-err')).toContainText('60 days');
  });

  test('large party note, inline validation and demo confirmation dialog', async ({ page }) => {
    await page.locator('#res-party').selectOption('9');
    await expect(page.locator('[data-large-party]')).toBeVisible();
    await page.locator('#res-party').selectOption('4');
    await expect(page.locator('[data-large-party]')).toBeHidden();

    await page.getByRole('button', { name: 'Request this table' }).click();
    await expect(page.locator('#res-date-err')).toHaveText('Choose a date.');
    await expect(page.locator('#res-date')).toBeFocused();

    await page.locator('#res-date').fill('2026-11-20');
    await page.locator('#res-name').fill('Jordan Vale');
    await page.locator('#res-email').fill('jordan@example');
    await page.locator('#res-phone').fill('503 555 0199');
    await page.getByRole('button', { name: 'Request this table' }).click();
    const emailErr = page.locator('#res-email-err');
    await expect(emailErr).toContainText("doesn't look right");
    await expect(page.locator('#res-email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#res-email')).toHaveAttribute('aria-describedby', /res-email-err/);
    await expect(page.locator('#res-email')).toBeFocused();

    await page.locator('#res-email').fill('jordan@example.com');
    await expect(emailErr).toHaveText('');
    await page.getByRole('button', { name: 'Request this table' }).click();
    await expect(page.locator('#res-time-err')).toHaveText('Choose a time.');

    const slot = page.locator('[data-slots] input:not(:disabled)').first();
    const minutes = Number(await slot.getAttribute('value'));
    await slot.check();
    await page.getByRole('button', { name: 'Request this table' }).click();

    const dialog = page.locator('[data-confirm]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('This is a demo.');
    await expect(dialog).toContainText('nothing was sent');
    await expect(dialog).toContainText('Friday, November 20');
    await expect(dialog).toContainText('4 guests');
    await expect(dialog).toContainText('Jordan Vale');
    const h = Math.floor(minutes / 60) - 12;
    await expect(dialog).toContainText(`${h}`);
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#res-name')).toHaveValue('');
  });
});

test.describe('open now badge', () => {
  const cases = [
    ['2026-11-17T19:30:00-08:00', /^Open now · closes at 10 pm$/, 'is-open'], // Tuesday evening
    ['2026-11-21T22:15:00-08:00', /^Open now · closes at 11 pm$/, 'is-open'], // Saturday late
    ['2026-11-16T12:00:00-08:00', /^Closed · opens Tue 5 pm$/, 'is-closed'], // Monday
    ['2026-11-22T15:00:00-08:00', /^Closed · opens today 4 pm$/, 'is-closed'], // Sunday afternoon
    ['2026-11-22T21:30:00-08:00', /^Closed · opens Tue 5 pm$/, 'is-closed'], // Sunday after close
  ];
  for (const [time, text, cls] of cases) {
    test(`shows the right state at ${time}`, async ({ page }) => {
      await page.clock.install({ time: at(time) });
      await page.goto('/');
      const badge = page.locator('.hero [data-open-status]');
      await expect(badge.locator('[data-status-text]')).toHaveText(text);
      await expect(badge).toHaveClass(new RegExp(cls));
    });
  }

  test('updates on its own as the minute turns', async ({ page }) => {
    await page.clock.install({ time: at('2026-11-18T21:58:30-08:00') }); // Wednesday, just before close
    await page.goto('/');
    const text = page.locator('.hero [data-status-text]');
    await expect(text).toHaveText('Open now · closes at 10 pm');
    for (let i = 0; i < 3; i++) await page.clock.fastForward(60 * 1000);
    await expect(text).toHaveText('Closed · opens Thu 5 pm');
    await expect(page.locator('tr.is-today th')).toHaveText(/Wednesday/);
  });
});

test.describe('gallery lightbox', () => {
  test('opens, moves with arrow keys, closes on Esc and restores focus', async ({ page }) => {
    await page.goto('/');
    const tiles = page.locator('[data-gallery] .tile');
    await expect(tiles).toHaveCount(6);
    await tiles.first().click();
    const dialog = page.locator('[data-lightbox]');
    await expect(dialog).toBeVisible();
    await expect(page.locator('[data-lb-title]')).toHaveText('The hearth at six');
    await expect(page.locator('[data-lb-count]')).toHaveText('1 of 6');
    await expect(page.locator('[data-lb-art] svg')).toHaveCount(1);

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-lb-title]')).toHaveText('Ribeye, resting');
    await expect(page.locator('[data-lb-count]')).toHaveText('2 of 6');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-lb-count]')).toHaveText('6 of 6');
    await expect(page.locator('[data-lb-title]')).toHaveText('Last table');
    await page.getByRole('button', { name: 'Next image' }).click();
    await expect(page.locator('[data-lb-count]')).toHaveText('1 of 6');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-lb-count]')).toHaveText('6 of 6');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    // Focus lands on the tile that was showing.
    await expect(tiles.nth(5)).toBeFocused();
  });

  test('close button returns focus to the opening tile', async ({ page }) => {
    await page.goto('/');
    const tile = page.locator('[data-gallery] .tile').nth(2);
    await tile.click();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('[data-lightbox]')).toBeHidden();
    await expect(tile).toBeFocused();
  });
});

test.describe('header and navigation', () => {
  test('header condenses on scroll', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('[data-header]');
    await expect(header).not.toHaveClass(/is-condensed/);
    await page.evaluate(() => window.scrollTo(0, 800));
    await expect(header).toHaveClass(/is-condensed/);
  });

  test('mobile nav is an accessible disclosure', async ({ page, isMobile }) => {
    await page.goto('/');
    const toggle = page.locator('.nav-toggle');
    const link = page.locator('#nav-list a[href="#menu"]');
    if (!isMobile) {
      await expect(toggle).toBeHidden();
      await expect(link).toBeVisible();
      return;
    }
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-controls', 'nav-list');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(link).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(link).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
    await toggle.click();
    await link.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(link).toBeHidden();
    const box = await toggle.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('hero background', () => {
  test('WebGL canvas runs, or the static fallback is used', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    const hero = page.locator('[data-hero]');
    await expect(hero).toHaveAttribute('data-fx', /^(webgl|static)$/, { timeout: 8000 });
    const fx = await hero.getAttribute('data-fx');
    await expect(page.locator('.hero-canvas')).toHaveCount(fx === 'webgl' ? 1 : 0);
    const bg = await page.locator('.hero-bg').evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain('radial-gradient');
  });

  test('WebGL draws when forced on (software GL)', async ({ page }) => {
    await page.goto('/?embers', { waitUntil: 'load' });
    const hero = page.locator('[data-hero]');
    await expect(hero).toHaveAttribute('data-fx', /^(webgl|static)$/, { timeout: 8000 });
    if ((await hero.getAttribute('data-fx')) === 'webgl') {
      const canvas = page.locator('.hero-canvas');
      await expect(canvas).toHaveClass(/is-on/);
      const size = await canvas.evaluate((c) => ({ w: c.width, cw: c.clientWidth, dpr: devicePixelRatio }));
      expect(size.w).toBeLessThanOrEqual(Math.ceil(size.cw * Math.min(1.5, size.dpr)) + 1);
    }
  });

  test('reduced motion uses the static gradient and no canvas', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?embers', { waitUntil: 'load' });
    await expect(page.locator('[data-hero]')).toHaveAttribute('data-fx', 'static', { timeout: 8000 });
    await expect(page.locator('.hero-canvas')).toHaveCount(0);
  });
});
