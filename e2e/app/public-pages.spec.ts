import { test, expect, EVENT, VENUE, operation } from './fixtures';

test('event HTML and metadata expose only the public teaser before hydration', async ({ request }) => {
  const response = await request.get(`/events/${EVENT.id}`);
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('Music and performances.');
  expect(html).toContain('Sign in to see when and where.');
  expect(html).toContain(`<link rel="canonical" href="https://hotmess.social/events/${EVENT.id}">`);
  for (const privateValue of [EVENT.startAt, VENUE.name, VENUE.profile.address, 'fixture-service-jwt', 'fixture-only']) {
    expect(html).not.toContain(privateValue);
  }
  expect(response.headers()['cache-control']).toContain('s-maxage=21600');
});

test('sign-in enriches the same URL through the direct API', async ({ page, api }) => {
  await page.goto(`/events/${EVENT.id}`);
  await expect(page.getByRole('heading', { name: 'Mess Hall', exact: true })).toBeVisible();
  expect(api.calls(operation('Event'))).toHaveLength(0);
  await page.getByRole('button', { name: 'Continue with Facebook' }).click();
  await expect(page.locator('.ak-hero h1')).toHaveText(EVENT.name);
  await expect(page).toHaveURL(`/events/${EVENT.id}`);
  expect(api.calls(operation('Event'))).toHaveLength(1);
});

test('signed-in cookies do not personalize cached HTML; sitemaps contain approved URLs', async ({ request }) => {
  const path = `/venues/${VENUE.id}`;
  const first = await request.get(path);
  const next = await request.get(`${path}?utm_source=google`, { headers: { Cookie: 'session=secret', Authorization: 'Bearer private' } });
  expect(await next.text()).toBe(await first.text());
  const sitemap = await request.get('/sitemap.xml?page=1');
  expect(await sitemap.text()).toContain(`/events/${EVENT.id}`);
  expect(await sitemap.text()).not.toContain('people/');
});

test('sitemap index lists the site pages and every listings page', async ({ request }) => {
  const index = await request.get('/sitemap.xml');
  expect(index.status()).toBe(200);
  const body = await index.text();
  expect(body).toContain('<loc>https://hotmess.social/sitemap-pages.xml</loc>');
  expect(body).toContain('<loc>https://hotmess.social/sitemap.xml?page=1</loc>');
  const pages = await request.get('/sitemap-pages.xml');
  expect(pages.status()).toBe(200);
  expect(await pages.text()).toContain('<loc>https://hotmess.social/safety</loc>');
});

test('a public person link previews with their name, line and picture', async ({ request }) => {
  const response = await request.get('/people/33333333-3333-4333-8333-333333333333');
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('<meta property="og:title" content="Kiki Riot">');
  expect(html).toContain('<meta property="og:description" content="Featured on Hot Mess in Seattle.">');
  expect(html).toContain('<meta property="og:image" content="https://api.audiencekit.com/v1/photos/kiki">');
  expect(response.headers()['x-robots-tag']).toBe('noindex');
});

test('a Community performer link names no one', async ({ request }) => {
  const response = await request.get('/people/44444444-4444-4444-8444-444444444444');
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('<meta property="og:title" content="A performer on Hot Mess">');
  expect(response.headers()['cache-control']).toBe('private, no-store');
});
