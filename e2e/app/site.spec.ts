import { test, expect, VENUE } from './fixtures';

test('the home page links to the app', async ({ page, api }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Hot Mess');
  await page.getByRole('link', { name: 'Open the app' }).click();
  await expect(page).toHaveURL(/\/app\/?$/);
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  expect(api.requests).toEqual([]);
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
