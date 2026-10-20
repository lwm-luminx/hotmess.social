import { test, expect, API, EVENT, PERSON, VENUE, operation } from './fixtures';

// Share links are served by the 404 page, as on GitHub Pages.
test.describe('signed in', () => {
  test.beforeEach(async ({ signedIn }) => { await signedIn(); });

  for (const [path, title] of [[`/venues/${VENUE.id}`, VENUE.name], [`/events/${EVENT.id}`, EVENT.name], [`/people/${PERSON.id}`, PERSON.name]]) {
    test(`${path.split('/')[1]} links open in the app`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('.ak-hero h1')).toHaveText(title);
      await expect(page).toHaveTitle(`${title} · Hot Mess`);
    });
  }

  test('upper-case ids open the same page', async ({ page, api }) => {
    await page.goto(`/people/${PERSON.id.toUpperCase()}`);
    await expect(page.locator('.ak-hero h1')).toHaveText(PERSON.name);
    expect(api.calls(operation('Person'))).toHaveLength(1);
  });

  test('a link to something deleted says it can\'t be found', async ({ page }) => {
    await page.goto('/events/44444444-4444-4444-8444-444444444444');
    await expect(page.getByText("We couldn't find that.")).toBeVisible();
  });

  test('a malformed link says the page doesn\'t exist', async ({ page, api }) => {
    await page.goto('/venues/not-a-uuid');
    await expect(page.getByText("That page doesn't exist.")).toBeVisible();
    expect(api.requests).toEqual([]);
  });
});

test('a share link asks to sign in first', async ({ page, api }) => {
  await page.goto(`/venues/${VENUE.id}`);
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue with Facebook' }).click();
  await expect(page.locator('.ak-hero h1')).toHaveText(VENUE.name);
  expect(api.calls(operation('ReportLocation'))).toEqual([]);
});

// Signed share links carry ?e=<expiry in base36>.<signature> (src/lib/routes.ts).
const token = (secondsFromNow: number) => `${Math.floor(Date.now() / 1000 + secondsFromNow).toString(36)}.AbCdEfGhIjKlMnOp`;

test.describe('signed links', () => {
  test.beforeEach(async ({ signedIn }) => { await signedIn(); });

  test('a link past its expiry says so without asking the API, and offers venues', async ({ page, api }) => {
    await page.goto(`/venues/${VENUE.id}?e=${token(-60)}`);
    await expect(page.getByRole('heading', { name: 'This link has expired' })).toBeVisible();
    await expect(page).toHaveTitle('Link expired · Hot Mess');
    await expect(page.locator('.ak-hero')).toHaveCount(0);
    expect(api.requests).toEqual([]);

    await page.getByRole('button', { name: 'Find venues' }).click();
    await expect(page).toHaveURL('/app/');
    await expect(page.getByText(VENUE.name).first()).toBeVisible();
  });

  test('a link the API says has expired never opens the record', async ({ page, api }) => {
    api.on('GET /v1/share', { status: 410, json: { error: 'EXPIRED', message: 'This link has expired' } });
    const e = token(3600);
    await page.goto(`/events/${EVENT.id}?e=${e}`);
    await expect(page.getByRole('heading', { name: 'This link has expired' })).toBeVisible();
    const check = new URL(api.calls('GET /v1/share')[0].url()).searchParams;
    expect(Object.fromEntries(check)).toEqual({ host: 'localhost', path: `/events/${EVENT.id}`, e });
    expect(api.calls(operation('Event'))).toEqual([]);
  });

  test('a link still in date opens', async ({ page, api }) => {
    api.on('GET /v1/share', { json: { kind: 'venue', id: VENUE.id, link_expires_at: '2026-11-20T00:00:00Z' } });
    await page.goto(`/venues/${VENUE.id}?e=${token(3600)}`);
    await expect(page.locator('.ak-hero h1')).toHaveText(VENUE.name);
  });

  test('a link opens as before when the check can\'t reach the API', async ({ page }) => {
    await page.route(`${API}/v1/share?**`, (route) => route.abort('internetdisconnected'));
    await page.goto(`/people/${PERSON.id}?e=${token(3600)}`);
    await expect(page.locator('.ak-hero h1')).toHaveText(PERSON.name);
  });
});

test('an expired link says so before asking to sign in', async ({ page }) => {
  await page.goto(`/venues/${VENUE.id}?e=${token(-60)}`);
  await expect(page.getByRole('heading', { name: 'This link has expired' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toHaveCount(0);
});
