import { test, expect, section, EVENT, FRIENDS, IMAGES, SEATTLE, VENUE } from './fixtures';

test.beforeEach(async ({ signedIn }) => { await signedIn(); });

test('shows your city, friends out, tonight\'s events and nearby venues', async ({ page, api }) => {
  await page.goto('/app/');
  const hero = page.locator('.ak-hero');
  await expect(hero.getByRole('heading', { level: 1 })).toHaveText('Capitol Hill');
  await expect(hero.locator('.ak-hero__eyebrow')).toHaveText('Seattle');
  await expect(hero.locator('img')).toHaveAttribute('src', `${IMAGES}/capitol-hill.png`);
  await expect(page).toHaveTitle('Now · Hot Mess');

  const friends = section(page, 'Friends out tonight');
  await expect(friends.locator('.ak-section__count')).toHaveText('2');
  await expect(friends.locator('.ak-person__name')).toHaveText(FRIENDS.map((f) => f.name));
  await expect(friends.getByRole('link')).toHaveCount(0);
  await expect(friends.getByRole('img', { name: 'Sam Rivera' })).toHaveText('SR');

  const events = section(page, 'Tonight and coming up');
  const event = events.getByRole('link');
  await expect(event).toHaveCount(1);
  await expect(event).toHaveAttribute('href', `/events/${EVENT.id}`);
  await expect(event.locator('.ak-card__title')).toHaveText(EVENT.name);
  await expect(event.locator('.ak-card__meta')).toHaveText([/^Fri, Oct 9 · 10:00\sPM – 2:00\sAM$/, VENUE.name, 'with Aurora Borealis']);
  await expect(event.locator('.ak-date')).toHaveText('OCT9');
  // Now never sends event covers, so the card shows the venue's photo.
  await expect(event.locator('img')).toHaveAttribute('src', VENUE.photo_url);

  const venues = section(page, 'Venues near you');
  const venue = venues.getByRole('link');
  await expect(venue).toHaveAttribute('href', `/venues/${VENUE.id}`);
  await expect(venue.locator('.ak-card__title')).toHaveText(VENUE.name);
  await expect(venue.locator('.ak-card__meta')).toHaveText([VENUE.address, '2 friends here']);
  await expect(venue.locator('.ak-card__badge')).toHaveText('390 ft');

  const [now] = api.calls('GET /v1/now');
  const params = new URL(now.url()).searchParams;
  expect(Number(params.get('latitude'))).toBeCloseTo(SEATTLE.latitude);
  expect(Number(params.get('longitude'))).toBeCloseTo(SEATTLE.longitude);
});

test('says which venue you\'re at, and that no friends are out yet', async ({ page, api }) => {
  api.on('GET /v1/now', { json: { title: VENUE.name, venue: { ...VENUE, distance: 2400 }, events: [] } });
  await page.goto('/app/');
  await expect(page.locator('.ak-hero h1')).toHaveText(VENUE.name);
  await expect(page.locator('.ak-hero img')).toHaveAttribute('src', VENUE.hero_url);
  await expect(page.locator('.ak-lede')).toHaveText(`You're at ${VENUE.name}.`);
  await expect(page.locator('.ak-lede').getByRole('link')).toHaveAttribute('href', `/venues/${VENUE.id}`);
  await expect(section(page, 'Friends out tonight')).toContainText('None of your friends are out yet.');
  await expect(section(page, 'Tonight and coming up')).toHaveCount(0);
  await expect(section(page, 'Venues near you')).toHaveCount(0);
  await expect(section(page, 'Here').locator('.ak-card__badge')).toHaveText('1.5 mi');
});

test('opens a venue from Now without reloading, and Back returns', async ({ page }) => {
  await page.goto('/app/');
  await page.evaluate(() => { (window as any).__samePage = true; });
  await section(page, 'Venues near you').getByRole('link').click();
  await expect(page).toHaveURL(`/venues/${VENUE.id}`);
  await expect(page.locator('.ak-hero h1')).toHaveText(VENUE.name);
  await expect(page).toHaveTitle(`${VENUE.name} · Hot Mess`);
  expect(await page.evaluate(() => (window as any).__samePage)).toBe(true);

  await page.goBack();
  await expect(page.locator('.ak-hero h1')).toHaveText('Capitol Hill');
  expect(await page.evaluate(() => (window as any).__samePage)).toBe(true);
});

test('a modified click leaves the in-app navigation to the browser', async ({ page, context }) => {
  await page.goto('/app/');
  const opened = context.waitForEvent('page');
  await section(page, 'Venues near you').getByRole('link').click({ modifiers: ['ControlOrMeta'] });
  await (await opened).close();
  await expect(page).toHaveURL(/\/app\/?$/);
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

test('survives a sparse Now with nothing but a title', async ({ page, api }) => {
  api.on('GET /v1/now', { json: {} });
  await page.goto('/app/');
  await expect(page.locator('.ak-hero h1')).toHaveText('Now');
  await expect(page.locator('.ak-hero img')).toHaveCount(0);
  await expect(section(page, 'Friends out tonight')).toContainText('None of your friends are out yet.');
});

test('signs out and asks to sign in again when the session has expired', async ({ page, api }) => {
  api.on('GET /v1/now', { status: 401 });
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hotmess.token'))).toBeNull();
});
