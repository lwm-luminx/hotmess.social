import { test, expect, TOKEN, NOW, VENUE, EVENT, PERSON, operation } from './fixtures';

test('signs in with Facebook, then shows Now', async ({ page, api }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  expect(api.requests).toEqual([]);

  await page.getByRole('button', { name: 'Continue with Facebook' }).click();
  await expect(page.getByRole('heading', { name: 'Capitol Hill' })).toBeVisible();

  expect(await page.evaluate(() => (window as any).__fbScope)).toBe('public_profile,email,user_friends');
  expect(await page.evaluate(() => (window as any).__fbInit)).toMatchObject({ appId: '1168782378316790', version: 'v26.0' });

  const [signIn] = api.calls('POST /v1/token');
  expect(signIn.postDataJSON()).toMatchObject({
    facebook_token: 'fb-user-token',
    host: 'hotmess.admin.audiencekit.com',
    facebook_app_id: '1168782378316790',
    device: { type: 'web', identifier: expect.any(String) },
  });
  expect(signIn.headers()['authorization']).toBeUndefined();

  expect(await page.evaluate(() => localStorage.getItem('hotmess.token'))).toBe(TOKEN);
  const [now] = api.calls(operation('ReportLocation'));
  expect(now.headers()['authorization']).toBe(`JWT ${TOKEN}`);
});

test('keeps the same device identifier across sign-ins', async ({ page, api }) => {
  await page.goto('/app/');
  await page.getByRole('button', { name: 'Continue with Facebook' }).click();
  await expect(page.getByRole('heading', { name: 'Capitol Hill' })).toBeVisible();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('hotmess.token'))).toBeNull();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue with Facebook' }).click();
  await expect(page.getByRole('heading', { name: 'Capitol Hill' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: 'Capitol Hill' })).toHaveCount(0);
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

test('shows an error when the API refuses the Facebook token', async ({ page, api }) => {
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
  expect(api.requests).toEqual([]);
});
