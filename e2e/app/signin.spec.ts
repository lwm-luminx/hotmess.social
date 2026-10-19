import { test, expect, TOKEN, AUDIENCE_ID, NOW, VENUE, EVENT, PERSON, operation } from './fixtures';

test('signs in with Facebook, then shows Now', async ({ page, api }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  // Before sign-in the site only asks which sign-in methods the audience offers.
  expect(api.requests.filter((r) => new URL(r.url()).pathname !== '/v1/token/methods')).toEqual([]);

  await page.getByRole('button', { name: 'Continue with Facebook' }).click();
  await expect(page.getByRole('heading', { name: 'Seattle' })).toBeVisible();

  expect(await page.evaluate(() => (window as any).__fbScope)).toBe('public_profile');
  expect(await page.evaluate(() => (window as any).__fbInit)).toMatchObject({ appId: '1168782378316790', version: 'v26.0' });

  const [signIn] = api.calls('POST /v1/token');
  expect(signIn.postDataJSON()).toMatchObject({
    facebook_token: 'fb-user-token',
    host: 'hotmess.admin.audiencekit.com',
    facebook_app_id: '1168782378316790',
    device: { type: 'web', identifier: expect.any(String) },
  });
  expect(signIn.headers()['authorization']).toBeUndefined();
  expect(signIn.headers()['x-audiencekit-api-version']).toBe('2026-10-11');

  // The token JSON names the audience, so the site never decodes the JWT.
  expect(await page.evaluate(() => localStorage.getItem('hotmess.token'))).toBe(TOKEN);
  expect(await page.evaluate(() => localStorage.getItem('hotmess.audience'))).toBe(AUDIENCE_ID);
  const [now] = api.calls(operation('ReportLocation'));
  expect(now.headers()['authorization']).toBe(`Bearer ${TOKEN}`);
  expect(new URL(now.url()).pathname).toBe(`/v1/audience/${AUDIENCE_ID}/graphql`);
  expect(api.calls('GET /v1/branding')).toEqual([]);
});

test('keeps the same device identifier across sign-ins', async ({ page, api }) => {
  await page.goto('/app/');
  await page.getByRole('button', { name: 'Continue with Facebook' }).click();
  await expect(page.getByRole('heading', { name: 'Seattle' })).toBeVisible();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('hotmess.token'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('hotmess.audience'))).toBeNull();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue with Facebook' }).click();
  await expect(page.getByRole('heading', { name: 'Seattle' })).toBeVisible();

  const [first, second] = api.calls('POST /v1/token').map((r) => r.postDataJSON().device.identifier);
  expect(second).toBe(first);
});

for (const path of [`/venues/${VENUE.id}`, `/events/${EVENT.id}`, `/people/${PERSON.id}`]) {
  test(`logs out from ${path} and returns to sign-in`, async ({ page, signedIn }) => {
    await signedIn();
    await page.goto(path);
    await expect(page.locator('#app h1')).toBeVisible();
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/$/);
    await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('hotmess.token'))).toBeNull();
  });
}

test('a pending response cannot restore the signed-in screen after logout', async ({ page, api, signedIn }) => {
  await signedIn();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  api.on(operation('ReportLocation'), async () => {
    await pending;
    return { json: { reportLocation: { now: NOW } } };
  });
  await page.goto('/app/');
  await expect.poll(() => api.calls(operation('ReportLocation')).length).toBe(1);
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  const response = page.waitForResponse((r) => r.request().postDataJSON()?.operationName === 'ReportLocation');
  release();
  await (await response).finished();
  // Let the browser process the completed request and any resulting React render.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Seattle' })).toHaveCount(0);
});

test('shows an error when Facebook sign-in is cancelled', async ({ page, api }) => {
  await page.addInitScript(() => { (window as any).__fbLogin = {}; });
  await page.goto('/app/');
  const button = page.getByRole('button', { name: 'Continue with Facebook' });
  await button.click();
  await expect(page.getByRole('alert')).toHaveText('Facebook sign-in was cancelled');
  await expect(button).toBeEnabled();
  expect(api.calls('POST /v1/token')).toEqual([]);
});

test('shows Facebook\'s reason when it refuses the token', async ({ page, api }) => {
  // A refused sign-in is 400 INVALID with Facebook's reason as the message (doc/TOKENS.md).
  api.on('POST /v1/token', { status: 400, json: { error: 'INVALID', message: 'Error validating access token: Session has expired' } });
  await page.goto('/app/');
  await page.getByRole('button', { name: 'Continue with Facebook' }).click();
  await expect(page.getByRole('alert')).toHaveText('Error validating access token: Session has expired');
  await expect(page.getByRole('button', { name: 'Continue with Facebook' })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('hotmess.token'))).toBeNull();
});

test('shows an error when the API refuses the sign-in without a reason', async ({ page, api }) => {
  api.on('POST /v1/token', { status: 401 });
  await page.goto('/app/');
  await page.getByRole('button', { name: 'Continue with Facebook' }).click();
  await expect(page.getByRole('alert')).toHaveText('POST /v1/token failed with 401');
  await expect(page.getByRole('button', { name: 'Continue with Facebook' })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('hotmess.token'))).toBeNull();
});

test('shows an error when Facebook Login cannot load', async ({ page, api }) => {
  await page.route('https://connect.facebook.net/**', (route) => route.abort());
  await page.goto('/app/');
  await page.getByRole('button', { name: 'Continue with Facebook' }).click();
  await expect(page.getByRole('alert')).toHaveText('Could not load Facebook Login');
  expect(api.requests.filter((r) => new URL(r.url()).pathname !== '/v1/token/methods')).toEqual([]);
});

test('offers Facebook while the audience has it on, and says so when it is off', async ({ page, api }) => {
  api.on('GET /v1/token/methods', { json: { methods: ['facebook', 'apple'] } });
  const asked = page.waitForRequest((r) => new URL(r.url()).pathname === '/v1/token/methods');
  await page.goto('/app/');
  expect(new URL((await asked).url()).searchParams.get('host')).toBe('hotmess.admin.audiencekit.com');
  await expect(page.getByRole('button', { name: 'Continue with Facebook' })).toBeVisible();

  api.on('GET /v1/token/methods', { json: { methods: ['apple'] } });
  await page.reload();
  await expect(page.getByText("Signing in on the web isn't available right now.")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Facebook' })).toHaveCount(0);
});

test('shows the audience\'s warning before Facebook sign-in, with Cancel and Continue', async ({ page, api }) => {
  api.on('GET /v1/token/methods', { json: { methods: ['facebook'], warnings: { facebook: 'Facebook login is only for testers' } } });
  await page.goto('/app/');
  await page.getByRole('button', { name: 'Continue with Facebook' }).click();
  const warning = page.getByRole('alertdialog');
  await expect(warning).toContainText('Facebook login is only for testers');

  await warning.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  expect(api.calls('POST /v1/token')).toEqual([]);

  await page.getByRole('button', { name: 'Continue with Facebook' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Seattle' })).toBeVisible();
  expect(api.calls('POST /v1/token')).toHaveLength(1);
});
