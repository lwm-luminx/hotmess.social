import { test, expect, VENUE, EVENT, TOKEN, operation, graphqlError } from './fixtures';

test('the home page leads with the stores', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.hero');
  await expect(hero.getByRole('link', { name: 'Download on the App Store' })).toHaveAttribute('href', /apps\.apple\.com\/.*id1195758383/);
  await expect(hero.getByRole('link', { name: 'Get it on Google Play' })).toHaveAttribute('href', /play\.google\.com\/store\/apps\/details\?id=social\.hotmess\.android\.app/);
  const getApp = page.getByRole('banner').getByRole('link', { name: 'Get the app' });
  await expect(getApp).toHaveAttribute('href', '/download');
  // The Apple and Google Play marks, drawn at icon size.
  await expect(getApp.locator('svg')).toHaveCount(2);
  for (const mark of await getApp.locator('svg').all()) expect((await mark.boundingBox())!.width).toBeLessThan(24);
  for (const glyph of await hero.locator('.store svg').all()) expect((await glyph.boundingBox())!.width).toBeGreaterThan(20);
  // Each mark's artwork fits its viewBox, so nothing is clipped.
  const clipped = await page.evaluate(() => [...document.querySelectorAll('.get-app svg, .store svg')].filter((svg) => {
    const box = (svg as SVGSVGElement).getBBox();
    const view = (svg as SVGSVGElement).viewBox.baseVal;
    return box.x < view.x || box.y < view.y || box.x + box.width > view.x + view.width || box.y + box.height > view.y + view.height;
  }).length);
  expect(clipped).toBe(0);
});

test('the poster page builds a poster once signed in', async ({ page, request, api }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Make a poster/ }).click();
  await expect(page).toHaveURL(/\/poster\/?(\?|$)/);

  // The builder is for people signed in to Hot Mess; the classic poster is for anyone.
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Poster preview/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Download the PDF' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue with Facebook' }).click();
  await expect(page.getByRole('img', { name: /Poster preview/ })).toBeVisible();
  expect(api.calls('POST /v1/token')).toHaveLength(1);

  // Adult-venue lines stay hidden until the poster is for an adult venue.
  await expect(page.getByRole('radio', { name: /Maybe grab a cheek/ })).toHaveCount(0);
  await page.getByRole('checkbox', { name: /adult venue/ }).check();
  await expect(page.getByRole('radio', { name: /Maybe grab a cheek/ })).toHaveCount(1);

  // The poster's options live in the address, so a poster can be linked to.
  await page.getByText('Venue TV', { exact: true }).click();
  await expect(page).toHaveURL(/format=tv/);
  const size = await page.getByRole('img', { name: /Poster preview/ }).evaluate((c) => [(c as HTMLCanvasElement).width, (c as HTMLCanvasElement).height]);
  expect(size[0]).toBeGreaterThan(size[1]);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^hot-mess-.*-tv-.*\.pdf$/);
  const { readFile } = await import('node:fs/promises');
  expect((await readFile((await file.path())!)).subarray(0, 8).toString()).toBe('%PDF-1.4');

  // The classic poster is still offered.
  await expect(page.getByRole('link', { name: 'Download the PDF' })).toHaveAttribute('href', '/poster/hot-mess-poster.pdf');
  expect((await request.get('/poster/hot-mess-poster.pdf')).headers()['content-type']).toContain('pdf');
});

test('a poster for a night is picked from its venue: a one-off, or a whole series', async ({ page, api, signedIn }) => {
  const LINK = `https://hotmess.social/events/${EVENT.id}?e=v3.abcdefghijklmnopqrstuv`;
  const SERIES_ID = '33333333-3333-4333-8333-333333333333';
  const at = { name: VENUE.name, venue: { id: VENUE.id, name: VENUE.name, locale: { name: 'Seattle' } } };
  const series = { id: SERIES_ID, name: 'Bear Night', recurrenceText: 'Every week on Thursday', startTime: '21:00', timeZone: 'America/Los_Angeles' };
  const posterEvent = { id: EVENT.id, name: EVENT.name, startAt: EVENT.startAt, endAt: EVENT.endAt, venue: at, eventSeries: null };
  const dates = ['2026-10-16T04:00:00Z', '2026-10-23T04:00:00Z'].map((startAt, i) => (
    { id: `4444444${i}-4444-4444-8444-444444444444`, name: 'Bear Night', startAt, endAt: null, venue: at, eventSeries: series }));
  api.on(operation('PosterSearch'), { json: {
    venues: { list: { nodes: [{ id: VENUE.id, name: VENUE.name, locale: { name: 'Seattle' }, profile: { address: VENUE.profile.address } }] } },
  } });
  api.on(operation('PosterNights'), { json: { venues: { venue: { events: { upcoming: { nodes: [...dates, posterEvent] } } } } } });
  api.on(operation('PosterEvent'), { json: { events: { event: posterEvent }, shareLink: { url: LINK } } });
  api.on(operation('PosterSeries'), { json: { events: { eventSeries: { ...series, events: dates } } } });
  await signedIn();
  await page.goto('/poster');

  // A night is found through its venue.
  await page.locator('.subjects label', { hasText: 'A night' }).click();
  await expect(page.getByRole('textbox', { name: 'Night' })).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Find the venue the night is at' }).fill('neigh');
  await page.getByRole('button', { name: /Neighbours/ }).click();

  // A series is offered once, as a whole; its dates never are.
  await expect(page.getByRole('heading', { name: 'Regular nights' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Bear Night/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Bear Night/ })).toContainText('Every week on Thursday · 9 PM');
  await expect(page.getByRole('heading', { name: 'One-off nights' })).toBeVisible();

  await page.getByRole('button', { name: /Mess Hall Fridays/ }).click();
  await expect(page.locator('.subject .picked')).toContainText('Neighbours · Seattle');
  await expect(page).toHaveURL(new RegExp(`event=${EVENT.id}`));
  await expect(page.getByRole('radio', { name: 'Your venue or night' })).toBeChecked();
  await expect(page.locator('.subject .hint')).toContainText('for a year');
  const [listing] = api.calls(operation('PosterEvent'));
  expect(listing.postDataJSON().variables).toEqual({ id: EVENT.id, path: `/events/${EVENT.id}` });

  // The series' poster names its schedule, and its code is the venue's link, which outlives any date.
  await page.locator('.subject .picked').getByRole('button', { name: 'Change' }).click();
  await page.getByRole('searchbox', { name: 'Find the venue the night is at' }).fill('neigh');
  await page.getByRole('button', { name: /Neighbours/ }).click();
  await page.getByRole('button', { name: /Bear Night/ }).click();
  await expect(page.locator('.subject .picked')).toContainText('Every week on Thursday · 9 PM');
  await expect(page).toHaveURL(new RegExp(`series=${SERIES_ID}`));
  await expect(page.locator('.subject .hint')).toContainText('hotmess.social/v/');

  // A linked poster loads its listing again.
  await page.reload();
  await expect(page.locator('.subject .picked')).toContainText('Bear Night');
});

test("a venue's poster carries its short link, which never expires", async ({ page, api, signedIn }) => {
  const posterVenue = { id: VENUE.id, name: VENUE.name, locale: { name: 'Seattle' }, profile: { address: VENUE.profile.address } };
  api.on(operation('PosterVenue'), { json: { venues: { venue: posterVenue } } });
  await signedIn();
  // The venue page's "Make a poster" link lands here with the venue picked.
  await page.goto(`/poster?venue=${VENUE.id}`);

  await expect(page.getByRole('radio', { name: /Your venue/ }).first()).toBeChecked();
  await expect(page.locator('.subject .picked')).toContainText(VENUE.name);
  await expect(page.locator('.subject .hint')).toContainText('hotmess.social/v/');
  await expect(page.locator('.subject .hint')).toContainText('never expires');
  const [listing] = api.calls(operation('PosterVenue'));
  expect(listing.postDataJSON().variables).toEqual({ id: VENUE.id });

  // Hot Mess itself takes the venue off the poster and puts the download code back.
  await page.locator('.subjects label').filter({ hasText: 'downloads the app' }).click();
  await expect(page.getByRole('radio', { name: 'Download the app' })).toBeChecked();
  await expect(page).not.toHaveURL(/venue=/);
});

test("a venue's managers print its cover and safety posters; anyone else is told to ask", async ({ page, api, signedIn }) => {
  const posterVenue = { id: VENUE.id, name: VENUE.name, locale: { name: 'Seattle' }, profile: { address: VENUE.profile.address } };
  api.on(operation('PosterVenue'), { json: { venues: { venue: posterVenue } } });
  api.on(operation('PosterCover'), { json: { venues: { venue: { id: VENUE.id, tickets: { cover: { cents: 1000, payable: true } } } } } });
  api.on(operation('PrintSafetyPoster'), graphqlError('FORBIDDEN', "Only the venue's managers can print its safety poster"));
  await signedIn();
  await page.goto(`/poster?venue=${VENUE.id}`);

  const print = page.locator('.print-posters');
  await expect(print.getByRole('heading', { name: `Print posters for ${VENUE.name}` })).toBeVisible();
  // The cover poster's code is the venue's own cover page, and the preview is the poster itself.
  await expect(print.locator('.hint').filter({ hasText: 'hotmess.social/cover/' })).toBeVisible();
  await expect(print.frameLocator('iframe').locator('body')).toContainText(VENUE.name);

  // It downloads as a PDF the site makes from the poster's options (Cloudflare's browser isn't here, so it's faked).
  const pdfs: Record<string, unknown>[] = [];
  await page.route('**/poster/pdf', (route) => {
    pdfs.push(route.request().postDataJSON());
    return route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.7\n%%EOF\n',
      headers: { 'content-disposition': 'attachment; filename="the-cover-poster.pdf"' } });
  });
  const download = page.waitForEvent('download');
  await print.getByRole('button', { name: 'Download the cover poster (PDF)' }).click();
  expect((await download).suggestedFilename()).toBe('the-cover-poster.pdf');
  expect(pdfs[0]).toMatchObject({ kind: 'cover', venueName: VENUE.name, paper: 'letter', link: expect.stringMatching(/^https:\/\/hotmess\.social\/cover\//) });

  // The safety poster previews a sample; printing asks the API for the code, which only managers get.
  await print.getByText('Safety poster', { exact: true }).click();
  await expect(print.frameLocator('iframe').locator('body')).toContainText(/sample/i);
  await print.getByRole('button', { name: 'Download the safety poster (PDF)' }).click();
  await expect(print).toContainText(`Only ${VENUE.name}'s managers can print its safety poster`);
  const [asked] = api.calls(operation('PrintSafetyPoster'));
  expect(asked.postDataJSON().variables).toEqual({ venueId: VENUE.id });
});

test('sharing on a computer downloads the poster and opens the composer with the caption', async ({ page, context, signedIn }) => {
  await context.route('https://x.com/**', (route) => route.fulfill({ contentType: 'text/html', body: 'composer' }));
  await signedIn();
  await page.goto('/poster?slogan=latin-roll-rs&format=letter');
  await expect(page.getByLabel('Caption')).toHaveValue(/Latin night, for those who can roll their Rs\.\n#HotMess/);
  const [download, composer] = await Promise.all([
    page.waitForEvent('download'), context.waitForEvent('page'), page.getByRole('button', { name: 'X', exact: true }).click(),
  ]);
  // X takes a wide picture, so a Letter poster is shared at 16:9 and the preview follows.
  expect(download.suggestedFilename()).toBe('hot-mess-latin-roll-rs-wide-riso.png');
  await expect(page.getByRole('radio', { name: /Wide post/ })).toBeChecked();
  await composer.waitForURL(/x\.com\/intent\/post\?text=Latin%20night/);
  await expect(page.getByRole('status')).toContainText('opened X with the caption');
});

test('the navbar signs in and out', async ({ page }) => {
  await page.goto('/poster');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/app/');
  await expect(nav.getByRole('button', { name: 'Sign out' })).toBeHidden();

  // Signing in on the page's own card turns the navbar to Sign out.
  await page.getByRole('button', { name: 'Continue with Facebook' }).click();
  await expect(page.getByRole('heading', { name: "Who's the poster for?" })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Sign in' })).toBeHidden();

  // Signing out from the navbar puts the sign-in card back.
  await nav.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Sign in' })).toBeVisible();
});

test('a poster search that fails offers signing in again', async ({ page, api, signedIn }) => {
  api.on(operation('PosterSearch'), { status: 404, json: { status: 404, error: 'Not Found' } });
  await signedIn();
  await page.goto('/poster');
  await page.locator('.subjects label').first().click();
  await page.getByRole('searchbox', { name: 'Find your venue', exact: true }).fill('mess');
  await page.getByRole('button', { name: 'sign in again' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
});

test('the home page links to the app', async ({ page, api }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Hot Mess');
  await page.getByRole('link', { name: 'Peek on the web' }).click();
  await expect(page).toHaveURL(/\/app\/?$/);
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  expect(api.requests.filter((r) => new URL(r.url()).pathname !== '/v1/token/methods')).toEqual([]);
});

// Every page, including the app and the 404 page that serves share links,
// says Hot Mess is a Love Wins Media product, above the header and in the footer.
for (const path of ['/', '/app/', `/venues/${VENUE.id}`]) {
  test(`${path} credits Love Wins Media`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(path);
    const band = page.locator('.lovewins-band a');
    await expect(page.locator('.lovewins-band')).toHaveText('A Love Wins Media product');
    await expect(band).toHaveText('Love Wins Media');
    await expect(band).toHaveAttribute('href', 'https://lovewins.media');
    await expect(band).toHaveAttribute('target', '_blank');
    const footer = page.locator('.site-footer');
    await expect(footer.getByRole('link', { name: 'Love Wins Media', exact: true })).toHaveAttribute('href', 'https://lovewins.media');
    await expect(footer).toContainText(`© ${new Date().getFullYear()} Love Wins Media, Inc.`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
}

test('the home page links to the safety page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'You choose who sees you.' })).toBeVisible();
  await page.getByRole('link', { name: /How Hot Mess keeps you safe/ }).click();
  await expect(page).toHaveURL(/\/safety\/?$/);
  await expect(page).toHaveTitle('Safety · Hot Mess');
  await expect(page.getByRole('heading', { name: 'Block, both ways' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Where we are tonight is not public information' })).toBeVisible();
  await expect(page.locator('.site-footer').getByRole('link', { name: 'Safety', exact: true })).toHaveAttribute('href', '/safety');
});

test('the money page explains promoted listings and shows the rate card', async ({ page }) => {
  await page.goto('/money');
  await expect(page).toHaveTitle('How Hot Mess makes money · Hot Mess');
  await expect(page.getByRole('heading', { name: 'Like a poster on the wall.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Placed by the city and the night' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What venues see' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Small venue/ })).toBeVisible();
  await expect(page.locator('.site-footer').getByRole('link', { name: 'How we make money' })).toHaveAttribute('href', '/money');
});

test('the top nav links every page and marks the current one', async ({ page }) => {
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/safety');
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const [name, href] of [['Safety', '/safety'], ['Poster', '/poster'], ['Web app', '/app/'], ['Get the app', '/download']]) {
      await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
      await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
    }
    await expect(nav.getByRole('link', { name: 'Safety', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Poster' })).not.toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
