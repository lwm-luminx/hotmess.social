import { test, expect, section, EVENT, EVENT_PAGE, IMAGES, PERSON, PERSON_PAGE, VENUE, operation } from './fixtures';

test.beforeEach(async ({ signedIn }) => { await signedIn(); });

test.describe('venue', () => {
  test('shows the place, what\'s coming up, and how to get there', async ({ page }) => {
    await page.goto(`/venues/${VENUE.id}`);
    await expect(page.locator('.ak-hero__image')).toHaveAttribute('src', VENUE.hero_url);
    await expect(page.locator('.ak-hero__badge')).toHaveAttribute('src', VENUE.photo_url);
    await expect(page.locator('.ak-hero__eyebrow')).toHaveCount(0);
    await expect(page.locator('.ak-lede')).toHaveText(VENUE.description);

    const upcoming = section(page, 'Upcoming');
    await expect(upcoming.locator('.ak-section__count')).toHaveText('1');
    const event = upcoming.getByRole('link');
    await expect(event).toHaveAttribute('href', `/events/${EVENT.id}`);
    // The venue's own page doesn't repeat its name on each event.
    await expect(event.locator('.ak-card__meta')).not.toContainText([VENUE.name]);

    await expect(page.getByRole('link', { name: VENUE.address })).toHaveAttribute('href',
      `https://maps.apple.com/?q=${encodeURIComponent(`${VENUE.name}, ${VENUE.address}`)}`);
    await expect(page.getByRole('link', { name: VENUE.phone })).toHaveAttribute('href', `tel:${VENUE.phone}`);
    const facebook = page.getByRole('link', { name: 'View on Facebook' });
    await expect(facebook).toHaveAttribute('href', `https://www.facebook.com/${VENUE.facebook_id}`);
    await expect(facebook).toHaveAttribute('target', '_blank');
  });

  test('says when nothing is announced at a venue', async ({ page, api }) => {
    const closed = { ...VENUE, facebook_id: '', phone: null, description: null, hero_url: null };
    api.on(operation('Venue'), { json: { venue: { ...closed, events: [] } } });
    await page.goto(`/venues/${VENUE.id}`);
    // With no photo of the place, the header falls back to the Page picture.
    await expect(page.locator('.ak-hero__image')).toHaveAttribute('src', VENUE.photo_url);
    await expect(section(page, 'Upcoming')).toContainText('Nothing announced yet.');
    await expect(page.getByRole('link', { name: 'View on Facebook' })).toHaveCount(0);
    await expect(page.locator('.ak-fact dt')).toHaveText(['Address']);
  });

  test('an event without its own photo uses a photo of the venue', async ({ page, api }) => {
    // Most venues have a photo of the place but no Page picture.
    api.on(operation('Venue'), { json: { venue: { ...VENUE, photo_url: null, events: [{ ...EVENT, venue: { id: VENUE.id, name: VENUE.name } }] } } });
    await page.goto(`/venues/${VENUE.id}`);
    await expect(section(page, 'Upcoming').locator('img')).toHaveAttribute('src', VENUE.hero_url);
  });
});

test.describe('event', () => {
  test('shows when, who\'s on the bill and where', async ({ page }) => {
    await page.goto(`/events/${EVENT.id}`);
    await expect(page.locator('.ak-hero__eyebrow')).toHaveText(/^Fri, Oct 9 · 10:00\sPM – 2:00\sAM$/);

    const bill = section(page, 'On the bill');
    await expect(bill.getByRole('link')).toHaveAttribute('href', `/people/${PERSON.id}`);
    await expect(bill.locator('.ak-person__role')).toHaveText('DJ');
    await expect(bill.getByRole('img', { name: PERSON.name })).toHaveText('AB');

    await expect(section(page, 'Where').getByRole('link')).toHaveAttribute('href', `/venues/${VENUE.id}`);
    await expect(page.locator('.ak-fact dt')).toHaveText(['When', 'Where', 'Address']);
    await expect(page.locator('.ak-fact').filter({ hasText: 'Where' }).getByRole('link')).toHaveAttribute('href', `/venues/${VENUE.id}`);
    await expect(page.getByRole('link', { name: 'Event on Facebook' })).toHaveAttribute('href', `https://www.facebook.com/events/${EVENT.facebook_id}/`);
  });

  test('links the venue on Facebook when the event has no Facebook event', async ({ page, api }) => {
    api.on(operation('Event'), { json: { event: { ...EVENT_PAGE, facebook_id: 0 } } });
    await page.goto(`/events/${EVENT.id}`);
    await expect(page.getByRole('link', { name: 'Event on Facebook' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Venue on Facebook' })).toHaveAttribute('href', `https://www.facebook.com/${VENUE.facebook_id}`);
  });

  test('a venue to be announced is named without a link', async ({ page, api }) => {
    api.on(operation('Event'), { json: { event: { ...EVENT_PAGE, venue: null, venue_name: 'Secret warehouse', facebook_id: null } } });
    await page.goto(`/events/${EVENT.id}`);
    await expect(page.getByText('At Secret warehouse (venue to be announced).')).toBeVisible();
    await expect(section(page, 'Where')).toHaveCount(0);
    await expect(page.locator('.ak-fact').filter({ hasText: 'Where' }).locator('dd')).toHaveText('Secret warehouse');
    await expect(page.locator('.ak-actions a')).toHaveCount(0);
  });

  test('opens a person from the bill', async ({ page }) => {
    await page.goto(`/events/${EVENT.id}`);
    await section(page, 'On the bill').getByRole('link').click();
    await expect(page).toHaveURL(`/people/${PERSON.id}`);
    await expect(page.locator('.ak-hero h1')).toHaveText(PERSON.name);
  });
});

test.describe('person', () => {
  test('shows their gigs, tracks and links', async ({ page }) => {
    await page.goto(`/people/${PERSON.id}`);
    await expect(page.locator('.ak-hero__image')).toHaveAttribute('src', PERSON.cover_url);
    await expect(page.locator('.ak-hero__avatar')).toHaveText('AB');

    await expect(section(page, 'Upcoming').getByRole('link')).toHaveAttribute('href', `/events/${EVENT.id}`);

    const track = section(page, 'Tracks').getByRole('link');
    await expect(track).toHaveAttribute('href', PERSON_PAGE.tracks[0].provider_url);
    await expect(track.locator('.ak-card__title')).toHaveText(PERSON_PAGE.tracks[0].title);
    await expect(track.locator('.ak-card__meta')).toHaveText('SoundCloud');
    await expect(track.locator('img')).toHaveAttribute('src', `${IMAGES}/track.png`);

    await expect(page.locator('.ak-links a')).toHaveText(['Instagram @aurora']);
    await expect(page.locator('.ak-links a')).toHaveAttribute('href', 'https://www.instagram.com/aurora');
    await expect(page.getByRole('link', { name: 'View on Facebook' })).toHaveAttribute('href', `https://www.facebook.com/${PERSON.facebook_id}`);
  });

  test('says when someone has nothing coming up', async ({ page, api }) => {
    api.on(operation('Person'), { json: { person: { id: PERSON.id, name: 'Solo' } } });
    await page.goto(`/people/${PERSON.id}`);
    await expect(page.locator('.ak-hero')).toHaveClass(/ak-hero--plain/);
    await expect(section(page, 'Upcoming')).toContainText('No upcoming events.');
    await expect(section(page, 'Tracks')).toHaveCount(0);
    await expect(page.locator('.ak-links')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'View on Facebook' })).toHaveCount(0);
  });
});

test('a photo that fails to load is hidden instead of showing a broken image', async ({ page, api }) => {
  api.on(operation('ReportLocation'), { json: { reportLocation: { now: { title: 'Now', venues: [{ ...VENUE, photo_url: `${IMAGES}/broken.png` }] } } } });
  await page.goto('/app/');
  const photo = section(page, 'Venues near you').locator('img');
  await expect(photo).toHaveCSS('visibility', 'hidden');
});
