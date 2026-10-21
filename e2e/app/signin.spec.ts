import { createHash } from 'node:crypto';
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

test('offers the methods the audience has on, and says so when none is', async ({ page, api }) => {
  api.on('GET /v1/token/methods', { json: { methods: ['facebook', 'apple'] } });
  const asked = page.waitForRequest((r) => new URL(r.url()).pathname === '/v1/token/methods');
  await page.goto('/app/');
  expect(new URL((await asked).url()).searchParams.get('host')).toBe('hotmess.admin.audiencekit.com');
  await expect(page.getByRole('button', { name: 'Continue with Apple' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Facebook' })).toBeVisible();

  api.on('GET /v1/token/methods', { json: { methods: ['apple'] } });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue with Apple' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Facebook' })).toHaveCount(0);

  api.on('GET /v1/token/methods', { json: { methods: ['google'] } });
  await page.reload();
  await expect(page.getByText("Signing in on the web isn't available right now.")).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(0);
});

test('offers only Facebook when the API cannot say which methods are on', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('button', { name: 'Continue with Facebook' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Continue with Apple' })).toHaveCount(0);
});

test('signs in with Apple, bound to a nonce, then shows Now', async ({ page, api }) => {
  api.on('GET /v1/token/methods', { json: { methods: ['facebook', 'apple'] } });
  await page.goto('/app/');
  await page.getByRole('button', { name: 'Continue with Apple' }).click();
  await expect(page.getByRole('heading', { name: 'Seattle' })).toBeVisible();

  // The sign-in is prepared before the click; the next one is prepared after it.
  const init = await page.evaluate(() => (window as any).__appleInits[0]);
  expect(init).toMatchObject({
    clientId: 'social.hotmess.signin',
    scope: 'name email',
    redirectURI: `${new URL(page.url()).origin}/app/`,
    usePopup: true,
  });
  const [signIn] = api.calls('POST /v1/token/apple');
  const body = signIn.postDataJSON();
  expect(body).toMatchObject({
    identity_token: 'apple-identity-token',
    authorization_code: 'apple-code',
    first_name: 'Dana',
    last_name: 'Kim',
    redirect_uri: init.redirectURI,
    host: 'hotmess.admin.audiencekit.com',
    device: { type: 'web', identifier: expect.any(String) },
  });
  // Apple gets the SHA-256 of the nonce; only the site has the nonce itself.
  expect(body.nonce).toMatch(/^[0-9a-f]{64}$/);
  expect(init.nonce).toBe(createHash('sha256').update(body.nonce).digest('hex'));
  expect(signIn.headers()['authorization']).toBeUndefined();
  expect(api.calls('POST /v1/token')).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('hotmess.token'))).toBe(TOKEN);
});

test('opens Apple\'s window from the click itself, so the browser allows it', async ({ page, api }) => {
  api.on('GET /v1/token/methods', { json: { methods: ['apple'] } });
  await page.goto('/app/');
  // The fake Apple script refuses a popup that isn't opened while the click is handled, as Safari does.
  await page.getByRole('button', { name: 'Continue with Apple' }).click();
  await expect(page.getByRole('heading', { name: 'Seattle' })).toBeVisible();
  expect(api.calls('POST /v1/token/apple')).toHaveLength(1);
});

test('says so when the browser blocks Apple\'s window', async ({ page, api }) => {
  api.on('GET /v1/token/methods', { json: { methods: ['apple'] } });
  await page.addInitScript(() => { (window as any).__appleError = { error: 'popup_blocked_by_browser' }; });
  await page.goto('/app/');
  await page.getByRole('button', { name: 'Continue with Apple' }).click();
  await expect(page.getByRole('alert')).toHaveText('Your browser blocked the Apple sign-in window. Allow pop-ups for hotmess.social and try again.');
});

test('shows an error when Apple sign-in is cancelled', async ({ page, api }) => {
  api.on('GET /v1/token/methods', { json: { methods: ['apple'] } });
  await page.addInitScript(() => { (window as any).__appleError = { error: 'popup_closed_by_user' }; });
  await page.goto('/app/');
  const button = page.getByRole('button', { name: 'Continue with Apple' });
  await button.click();
  await expect(page.getByRole('alert')).toHaveText('Apple sign-in was cancelled');
  await expect(button).toBeEnabled();
  expect(api.calls('POST /v1/token/apple')).toEqual([]);
});

test('refuses an Apple answer for another sign-in', async ({ page, api }) => {
  api.on('GET /v1/token/methods', { json: { methods: ['apple'] } });
  await page.addInitScript(() => { (window as any).__appleState = 'someone-elses-state'; });
  await page.goto('/app/');
  await page.getByRole('button', { name: 'Continue with Apple' }).click();
  await expect(page.getByRole('alert')).toHaveText("Apple sign-in didn't finish");
  expect(api.calls('POST /v1/token/apple')).toEqual([]);
});

test('shows an error when Sign in with Apple cannot load', async ({ page, api }) => {
  api.on('GET /v1/token/methods', { json: { methods: ['apple'] } });
  await page.route('https://appleid.cdn-apple.com/**', (route) => route.abort());
  await page.goto('/app/');
  await page.getByRole('button', { name: 'Continue with Apple' }).click();
  await expect(page.getByRole('alert')).toHaveText('Could not load Sign in with Apple');
});

test('shows the API\'s refusal of an Apple sign-in', async ({ page, api }) => {
  api.on('GET /v1/token/methods', { json: { methods: ['apple'] } });
  api.on('POST /v1/token/apple', { status: 401, json: { error: 'UNAUTHENTICATED', message: "Apple didn't vouch for that sign-in" } });
  await page.goto('/app/');
  await page.getByRole('button', { name: 'Continue with Apple' }).click();
  await expect(page.getByRole('alert')).toHaveText("Apple didn't vouch for that sign-in");
  expect(await page.evaluate(() => localStorage.getItem('hotmess.token'))).toBeNull();
});

test('shows the audience\'s warning before Apple sign-in, and only before Apple', async ({ page, api }) => {
  api.on('GET /v1/token/methods', { json: { methods: ['facebook', 'apple'], warnings: { apple: 'Apple sign-in is new, tell us if it breaks' } } });
  await page.goto('/app/');
  await page.getByRole('button', { name: 'Continue with Apple' }).click();
  const warning = page.getByRole('alertdialog');
  await expect(warning).toContainText('Apple sign-in is new, tell us if it breaks');
  await warning.getByRole('button', { name: 'Cancel' }).click();
  expect(api.calls('POST /v1/token/apple')).toEqual([]);

  await page.getByRole('button', { name: 'Continue with Facebook' }).click();
  await expect(page.getByRole('heading', { name: 'Seattle' })).toBeVisible();
  expect(api.calls('POST /v1/token')).toHaveLength(1);
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
