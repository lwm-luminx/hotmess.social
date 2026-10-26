import { test, expect, TOKEN } from './fixtures';

// /discover lists every public venue, event and post, but only to someone signed in to Hot Mess (src/app/Discover.tsx).
test('Discover asks for sign-in and its HTML lists nothing', async ({ page, request }) => {
  const html = await (await request.get('/discover')).text();
  expect(html).not.toContain('Neighbours');
  expect(html).not.toContain('Mess Hall');
  await page.goto('/discover');
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  await expect(page.getByText('Sign in to browse every venue, event and post on Hot Mess.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Neighbours' })).toHaveCount(0);
});

test('Discover lists venues and events once signed in', async ({ page, signedIn }) => {
  await signedIn();
  await page.goto('/discover');
  await expect(page.getByRole('link', { name: 'Neighbours' })).toHaveAttribute('href', '/venues/11111111-1111-4111-8111-111111111111');
  await expect(page.getByRole('link', { name: 'Mess Hall' })).toBeVisible();
});

test('signing in from Discover shows the listings', async ({ page }) => {
  await page.goto('/discover');
  await page.getByRole('button', { name: 'Continue with Facebook' }).click();
  await expect(page.getByRole('link', { name: 'Neighbours' })).toBeVisible();
});

test('Discover listings answer only a signed-in session, and are never cached', async ({ request }) => {
  const anonymous = await request.get('/discover/listings');
  expect(anonymous.status()).toBe(401);
  expect(await anonymous.text()).not.toContain('Neighbours');
  expect((await request.get('/discover/listings', { headers: { Authorization: 'Bearer someone-else' } })).status()).toBe(401);
  const signed = await request.get('/discover/listings', { headers: { Authorization: `Bearer ${TOKEN}` } });
  expect(signed.status()).toBe(200);
  expect((await signed.json()).listings.map((item: { title: string }) => item.title)).toEqual(['Neighbours', 'Mess Hall']);
  expect(signed.headers()['cache-control']).toBe('private, no-store');
});

test('a session the API refuses goes back to sign-in', async ({ page, signedIn }) => {
  await signedIn('expired.session.jwt');
  await page.goto('/discover');
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hotmess.token'))).toBeNull();
});
