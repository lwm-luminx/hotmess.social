import { test, expect, SEATTLE, EVENT, VENUE } from './fixtures';

test.beforeEach(async ({ signedIn }) => { await signedIn(); });

test('shows tonight\'s events and venues around you', async ({ page, api }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { level: 1, name: 'Capitol Hill' })).toBeVisible();
  await expect(page).toHaveTitle('Now · Hot Mess');

  const tonight = page.locator('section', { has: page.getByRole('heading', { name: 'Tonight' }) });
  await expect(tonight.getByRole('link')).toHaveText([new RegExp(`${EVENT.name}.*${VENUE.name}`)]);
  const venues = page.locator('section', { has: page.getByRole('heading', { name: 'Venues' }) });
  await expect(venues.getByRole('link')).toHaveText([`${VENUE.name}${VENUE.address}`]);

  const [now] = api.calls('GET /v1/now');
  const params = new URL(now.url()).searchParams;
  expect(Number(params.get('latitude'))).toBeCloseTo(SEATTLE.latitude);
  expect(Number(params.get('longitude'))).toBeCloseTo(SEATTLE.longitude);
});

test('shows the venue you\'re at when the API returns only one', async ({ page, api }) => {
  api.on('GET /v1/now', { json: { title: VENUE.name, venue: VENUE } });
  await page.goto('/app/');
  await expect(page.getByRole('heading', { level: 1, name: VENUE.name })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Venues' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tonight' })).toHaveCount(0);
});

test('opens a venue from Now without reloading, and Back returns', async ({ page }) => {
  await page.goto('/app/');
  await page.evaluate(() => { (window as any).__samePage = true; });
  await page.getByRole('link', { name: new RegExp(VENUE.address) }).click();
  await expect(page).toHaveURL(`/venues/${VENUE.id}`);
  await expect(page.getByRole('heading', { level: 1, name: VENUE.name })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__samePage)).toBe(true);

  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Capitol Hill' })).toBeVisible();
});

test('asks for location when it is blocked', async ({ page, context, api }) => {
  await context.clearPermissions();
  await page.goto('/app/');
  await expect(page.getByText('Allow location access for hotmess.social and reload.')).toBeVisible();
  expect(api.calls('GET /v1/now')).toEqual([]);
});

// The failure Rick saw on hotmess.social/app when GET /v1/now returned 500.
test('says the server is unreachable when Now fails', async ({ page, api }) => {
  api.on('GET /v1/now', { status: 500 });
  await page.goto('/app/');
  await expect(page.getByText("Hot Mess couldn't reach its server. Try again in a moment.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hotmess.token'))).not.toBeNull();
});

test('signs out and asks to sign in again when the session has expired', async ({ page, api }) => {
  api.on('GET /v1/now', { status: 401 });
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hotmess.token'))).toBeNull();
});
