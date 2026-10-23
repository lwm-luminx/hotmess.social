import { test, expect, VENUE } from './fixtures';

test('the home page leads with the stores', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.hero');
  await expect(hero.getByRole('link', { name: 'Download on the App Store' })).toHaveAttribute('href', /apps\.apple\.com\/.*id1195758383/);
  await expect(hero.getByRole('link', { name: 'Get it on Google Play' })).toHaveAttribute('href', /play\.google\.com\/store\/apps\/details\?id=social\.hotmess\.android\.app/);
  const getApp = page.getByRole('banner').getByRole('link', { name: 'Get the app' });
  await expect(getApp).toHaveAttribute('href', '/download');
  // The Apple and Google Play marks, drawn at icon size.
  await expect(getApp.locator('svg')).toHaveCount(2);
  for (const mark of await getApp.locator('svg').all()) expect((await mark.boundingBox())!.width).toBeLessThan(24);
  for (const glyph of await hero.locator('.store svg').all()) expect((await glyph.boundingBox())!.width).toBeGreaterThan(20);
  // Each mark's artwork fits its viewBox, so nothing is clipped.
  const clipped = await page.evaluate(() => [...document.querySelectorAll('.get-app svg, .store svg')].filter((svg) => {
    const box = (svg as SVGSVGElement).getBBox();
    const view = (svg as SVGSVGElement).viewBox.baseVal;
    return box.x < view.x || box.y < view.y || box.x + box.width > view.x + view.width || box.y + box.height > view.y + view.height;
  }).length);
  expect(clipped).toBe(0);
});

test('the poster page builds a poster', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Make a poster/ }).click();
  await expect(page).toHaveURL(/\/poster\/?(\?|$)/);
  await expect(page.getByRole('img', { name: /Poster preview/ })).toBeVisible();

  // Adult-venue lines stay hidden until the poster is for an adult venue.
  await expect(page.getByRole('radio', { name: /Maybe grab a cheek/ })).toHaveCount(0);
  await page.getByRole('checkbox', { name: /adult venue/ }).check();
  await expect(page.getByRole('radio', { name: /Maybe grab a cheek/ })).toHaveCount(1);

  // The poster's options live in the address, so a poster can be linked to.
  await page.getByText('Venue TV', { exact: true }).click();
  await expect(page).toHaveURL(/format=tv/);
  const size = await page.getByRole('img', { name: /Poster preview/ }).evaluate((c) => [(c as HTMLCanvasElement).width, (c as HTMLCanvasElement).height]);
  expect(size[0]).toBeGreaterThan(size[1]);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^hot-mess-.*-tv-.*\.pdf$/);
  const { readFile } = await import('node:fs/promises');
  expect((await readFile((await file.path())!)).subarray(0, 8).toString()).toBe('%PDF-1.4');

  // The classic poster is still offered.
  await expect(page.getByRole('link', { name: 'Download the PDF' })).toHaveAttribute('href', '/poster/hot-mess-poster.pdf');
  expect((await request.get('/poster/hot-mess-poster.pdf')).headers()['content-type']).toContain('pdf');
});

test('the home page links to the app', async ({ page, api }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Hot Mess');
  await page.getByRole('link', { name: 'Peek on the web' }).click();
  await expect(page).toHaveURL(/\/app\/?$/);
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  expect(api.requests.filter((r) => new URL(r.url()).pathname !== '/v1/token/methods')).toEqual([]);
});

// Every page, including the app and the 404 page that serves share links,
// says Hot Mess is a Love Wins Media product, above the header and in the footer.
for (const path of ['/', '/app/', `/venues/${VENUE.id}`]) {
  test(`${path} credits Love Wins Media`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(path);
    const band = page.locator('.lovewins-band a');
    await expect(page.locator('.lovewins-band')).toHaveText('A Love Wins Media product');
    await expect(band).toHaveText('Love Wins Media');
    await expect(band).toHaveAttribute('href', 'https://lovewins.media');
    await expect(band).toHaveAttribute('target', '_blank');
    const footer = page.locator('.site-footer');
    await expect(footer.getByRole('link', { name: 'Love Wins Media', exact: true })).toHaveAttribute('href', 'https://lovewins.media');
    await expect(footer).toContainText(`© ${new Date().getFullYear()} Love Wins Media, Inc.`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
}

test('the home page links to the safety page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'You choose who sees you.' })).toBeVisible();
  await page.getByRole('link', { name: /How Hot Mess keeps you safe/ }).click();
  await expect(page).toHaveURL(/\/safety\/?$/);
  await expect(page).toHaveTitle('Safety · Hot Mess');
  await expect(page.getByRole('heading', { name: 'Block, both ways' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Where we are tonight is not public information' })).toBeVisible();
  await expect(page.locator('.site-footer').getByRole('link', { name: 'Safety' })).toHaveAttribute('href', '/safety');
});

test('the money page explains promoted listings and shows the rate card', async ({ page }) => {
  await page.goto('/money');
  await expect(page).toHaveTitle('How Hot Mess makes money · Hot Mess');
  await expect(page.getByRole('heading', { name: 'Like a poster on the wall.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Placed by the city and the night' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What venues see' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Small venue/ })).toBeVisible();
  await expect(page.locator('.site-footer').getByRole('link', { name: 'How we make money' })).toHaveAttribute('href', '/money');
});

test('the top nav links every page and marks the current one', async ({ page }) => {
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/safety');
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const [name, href] of [['Safety', '/safety'], ['Poster', '/poster'], ['Web app', '/app/'], ['Get the app', '/download']]) {
      await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
      await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
    }
    await expect(nav.getByRole('link', { name: 'Safety' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Poster' })).not.toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
