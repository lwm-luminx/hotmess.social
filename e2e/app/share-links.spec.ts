import { test, expect, API, EVENT, PERSON, VENUE, operation } from './fixtures';

// Share links render public HTML, then hydrate into the authenticated SPA.
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
    await expect(page.getByText('Not found', { exact: true })).toBeVisible();
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

// Ping invitations, texted to contacts who may not have the app (src/pages/pings/[id].astro). The token is opaque.
test.describe('ping invitations', () => {
  const PING = '55555555-5555-4555-8555-555555555555';
  const link = `/pings/${PING}?e=v3.abc`;

  test('an invitation shows the plan and the stores', async ({ page, api }) => {
    const expiresAt = new Date(Date.now() + 6 * 3600 * 1000);
    api.on('GET /v1/share/invitation', { json: {
      kind: 'ping', id: PING, title: 'Jordan wants to go out', note: 'Drinks first?', sender_name: 'Jordan',
      expires_at: expiresAt.toISOString(),
      targets: [{ id: VENUE.id, name: VENUE.name, path: `/venues/${VENUE.id}` }, { id: EVENT.id, name: EVENT.name, path: `/events/${EVENT.id}` }],
    } });
    const response = await page.goto(link);
    expect(response?.headers()['x-robots-tag']).toBe('noindex');
    expect(response?.headers()['cache-control']).toContain('no-store');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await expect(page.getByRole('heading', { name: 'Jordan wants to go out' })).toBeVisible();
    await expect(page).toHaveTitle('Jordan wants to go out · Hot Mess');
    await expect(page.getByText('Drinks first?')).toBeVisible();
    await expect(page.getByRole('link', { name: VENUE.name })).toHaveAttribute('href', `/venues/${VENUE.id}`);
    await expect(page.getByRole('link', { name: EVENT.name })).toHaveAttribute('href', `/events/${EVENT.id}`);
    const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }).format(expiresAt);
    await expect(page.locator('.ends')).toHaveText(`Ends ${time}`);
    await expect(page.getByRole('link', { name: 'Download on the App Store' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get it on Google Play' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open in Hot Mess' })).toHaveAttribute('href', link);

    const check = new URL(api.calls('GET /v1/share/invitation')[0].url()).searchParams;
    expect(Object.fromEntries(check)).toEqual({ host: 'localhost', path: `/pings/${PING}`, e: 'v3.abc' });
  });

  test('an ended invitation says so and still offers the stores', async ({ page, api }) => {
    api.on('GET /v1/share/invitation', { status: 410, json: { error: 'EXPIRED', message: 'This link has expired' } });
    await page.goto(link);
    await expect(page.getByRole('heading', { name: 'This Ping has ended' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download on the App Store' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open in Hot Mess' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Jordan wants to go out' })).toHaveCount(0);
  });

  test('a link without a token has ended without asking the API', async ({ page, api }) => {
    await page.goto(`/pings/${PING}`);
    await expect(page.getByRole('heading', { name: 'This Ping has ended' })).toBeVisible();
    expect(api.calls('GET /v1/share/invitation')).toEqual([]);
  });
});
