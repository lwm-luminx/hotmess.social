import { test, expect, VENUE } from './fixtures';

test('the home page leads with the stores', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.hero');
  await expect(hero.getByRole('link', { name: 'Download on the App Store' })).toHaveAttribute('href', /apps\.apple\.com\/.*id1195758383/);
  await expect(hero.getByRole('link', { name: 'Get it on Google Play' })).toHaveAttribute('href', /play\.google\.com\/store\/apps\/details\?id=social\.hotmess\.android\.app/);
  await expect(page.getByRole('banner').getByRole('link', { name: 'Get the app' })).toHaveAttribute('href', '/download');
});

test('the poster page offers the printable poster', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Get the poster/ }).click();
  await expect(page).toHaveURL(/\/poster\/?$/);
  const pdf = page.getByRole('link', { name: 'Download the PDF' });
  await expect(pdf).toHaveAttribute('href', '/poster/hot-mess-poster.pdf');
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
    await expect(band).toHaveText('A Love Wins Media product');
    await expect(band).toHaveAttribute('href', 'https://lovewins.media');
    await expect(band).toHaveAttribute('target', '_blank');
    const footer = page.locator('.site-footer');
    await expect(footer.getByRole('link', { name: 'A Love Wins Media product' })).toHaveAttribute('href', 'https://lovewins.media');
    await expect(footer).toContainText(`© ${new Date().getFullYear()} Love Wins Media, Inc.`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
}
