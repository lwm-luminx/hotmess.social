import { test, expect } from './fixtures';

const APP_STORE = 'https://apps.apple.com/us/app/hot-mess-gay-nightlife/id1195758383';
const PLAY_BETA = 'https://play.google.com/apps/testing/social.hotmess.android.app';

test('/download on a desktop shows both stores', async ({ page }) => {
  await page.goto('/download');
  await expect(page.getByRole('link', { name: 'Get it on the App Store' })).toHaveAttribute('href', APP_STORE);
  await expect(page.getByRole('link', { name: 'Join the Android beta' })).toHaveAttribute('href', PLAY_BETA);
  expect(page.url()).toMatch(/\/download\/?$/);
});

for (const [name, userAgent, store] of [
  ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', APP_STORE],
  ['Android', 'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', PLAY_BETA],
] as const) {
  test.describe(name, () => {
    test.use({ userAgent });

    test(`/download sends ${name} to its store`, async ({ page }) => {
      await page.route(store, (route) => route.fulfill({ contentType: 'text/html', body: '<title>Store</title>' }));
      await page.goto('/download');
      await expect(page).toHaveURL(store);
    });
  });
}
