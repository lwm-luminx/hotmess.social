// The deployed site against the real API. Runs on a schedule and after each
// deploy, so a broken endpoint (like GET /v1/now returning 500) shows up as a
// failed run instead of a report from someone opening the app.
import { test, expect, type Page } from '@playwright/test';
import { API_BASE, canSignIn, sessionToken } from './session';

const here = {
  latitude: Number(process.env.E2E_LATITUDE ?? 47.6062),
  longitude: Number(process.env.E2E_LONGITUDE ?? -122.3321),
};

const UNREACHABLE = "Hot Mess couldn't reach its server";

// Fails on any API response of 500 or more, naming the endpoint.
function watchAPI(page: Page) {
  const failures: string[] = [];
  page.on('response', (response) => {
    if (response.url().startsWith(API_BASE) && response.status() >= 500) {
      failures.push(`${response.request().method()} ${new URL(response.url()).pathname} returned ${response.status()}`);
    }
  });
  return failures;
}

test('the home page and the app load', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Open the app' })).toBeVisible();
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Facebook' })).toBeEnabled();
});

test.describe('signed in', () => {
  test.skip(!canSignIn, 'set HOTMESS_E2E_TOKEN, or FB_TEST_APP_ID and FB_TEST_APP_SECRET');

  test.beforeEach(async ({ page, context }) => {
    const token = await sessionToken();
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(here);
    await page.addInitScript((t) => localStorage.setItem('hotmess.token', t), token);
  });

  test('Now loads around Seattle, and its venues and events open', async ({ page }) => {
    const failures = watchAPI(page);
    const now = page.waitForResponse((r) => r.url().startsWith(`${API_BASE}/v1/now`));
    await page.goto('/app/');
    expect((await now).status(), 'GET /v1/now').toBe(200);

    await expect(page.locator('#app h1')).toBeVisible();
    await expect(page.getByText(UNREACHABLE)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toHaveCount(0);

    // Follow the first venue and event Now offers, if there are any tonight.
    for (const kind of ['venues', 'events']) {
      await page.goto('/app/');
      const link = page.locator(`#app a[href^="/${kind}/"]`).first();
      await expect(page.locator('#app h1')).toBeVisible();
      if (await link.count() === 0) continue;
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/${kind}/`));
      await expect(page.locator('#app h1')).toBeVisible();
      await expect(page.getByText(UNREACHABLE)).toHaveCount(0);
    }

    expect(failures).toEqual([]);
  });
});
