import { test, expect, section, connection, graphqlError, EVENT, IMAGES, LOCALE, PERSON, PERSON_PAGE, VENUE, operation } from './fixtures';

test.beforeEach(async ({ signedIn }) => { await signedIn(); });

test.describe('venue', () => {
  test('shows the place, what\'s coming up, and how to get there', async ({ page }) => {
    await page.goto(`/venues/${VENUE.id}`);
    await expect(page.locator('.ak-hero__image')).toHaveAttribute('src', VENUE.bannerUrl);
    await expect(page.locator('.ak-hero__badge')).toHaveAttribute('src', VENUE.photoUrl);
    await expect(page.locator('.ak-hero__eyebrow')).toHaveCount(0);
    await expect(page.locator('.ak-lede')).toHaveText(VENUE.description);

    const upcoming = section(page, 'Upcoming');
    await expect(upcoming.locator('.ak-section__count')).toHaveText('1');
    const event = upcoming.getByRole('link');
    await expect(event).toHaveAttribute('href', `/events/${EVENT.id}`);
    // The venue's own page doesn't repeat its name on each event.
    await expect(event.locator('.ak-card__meta')).not.toContainText([VENUE.name]);

    const { address, phone, facebook } = VENUE.profile;
    await expect(page.getByRole('link', { name: address })).toHaveAttribute('href',
      `https://maps.apple.com/?q=${encodeURIComponent(`${VENUE.name}, ${address}`)}`);
    await expect(page.getByRole('link', { name: phone })).toHaveAttribute('href', `tel:${phone}`);
    const link = page.getByRole('link', { name: 'View on Facebook' });
    await expect(link).toHaveAttribute('href', `https://www.facebook.com/${facebook.facebookId}`);
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('says when nothing is announced at a venue', async ({ page, api }) => {
    // No banner, no Page: the API sends null, never "".
    const closed = { ...VENUE, bannerUrl: null, description: null, profile: { address: VENUE.profile.address, phone: null, facebook: { facebookId: null } } };
    api.on(operation('Venue'), { json: { venues: { venue: { ...closed, events: { upcoming: connection() } } } } });
    await page.goto(`/venues/${VENUE.id}`);
    // With no banner, the header falls back to the venue's own photo.
    await expect(page.locator('.ak-hero__image')).toHaveAttribute('src', VENUE.photoUrl);
    await expect(page.locator('.ak-hero__badge')).toHaveCount(0);
    await expect(section(page, 'Upcoming')).toContainText('Nothing announced yet.');
    await expect(page.getByRole('link', { name: 'View on Facebook' })).toHaveCount(0);
    await expect(page.locator('.ak-fact dt')).toHaveText(['Address']);
  });

  test('an event without its own photo uses a photo of the venue', async ({ page, api }) => {
    // Most venues have a banner but no photo of their own.
    const venue = { ...VENUE, photoUrl: null };
    api.on(operation('Venue'), { json: { venues: { venue: { ...venue, events: { upcoming: connection({ ...EVENT, venue: { name: venue.name, venue } }) } } } } });
    await page.goto(`/venues/${VENUE.id}`);
    await expect(section(page, 'Upcoming').locator('img')).toHaveAttribute('src', VENUE.bannerUrl);
  });

  test('a venue you may not see says so', async ({ page, api }) => {
    api.on(operation('Venue'), graphqlError('FORBIDDEN', 'Not allowed', { reason: 'no_permission' }));
    await page.goto(`/venues/${VENUE.id}`);
    await expect(page.getByText("You can't see that.")).toBeVisible();
    expect(api.calls('POST /v1/client_errors')).toEqual([]);
  });
});

test.describe('event', () => {
  test('shows when, who\'s on the bill and where', async ({ page }) => {
    await page.goto(`/events/${EVENT.id}`);
    await expect(page.locator('.ak-hero__eyebrow')).toHaveText(/^Fri, Oct 9 · 10:00\sPM – 2:00\sAM$/);

    const bill = section(page, 'On the bill');
    await expect(bill.getByRole('link')).toHaveAttribute('href', `/people/${PERSON.id}`);
    await expect(bill.getByRole('img', { name: PERSON.name })).toHaveText('AB');

    await expect(section(page, 'Where').getByRole('link')).toHaveAttribute('href', `/venues/${VENUE.id}`);
    await expect(page.locator('.ak-fact dt')).toHaveText(['When', 'Where', 'Address']);
    await expect(page.locator('.ak-fact').filter({ hasText: 'Where' }).getByRole('link')).toHaveAttribute('href', `/venues/${VENUE.id}`);
    await expect(page.getByRole('link', { name: 'Event on Facebook' })).toHaveAttribute('href', `https://www.facebook.com/events/${EVENT.facebookId}/`);
  });

  test('links the venue on Facebook when the event has no Facebook event', async ({ page, api }) => {
    api.on(operation('Event'), { json: { events: { event: { ...EVENT, facebookId: null } } } });
    await page.goto(`/events/${EVENT.id}`);
    await expect(page.getByRole('link', { name: 'Event on Facebook' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Venue on Facebook' })).toHaveAttribute('href', `https://www.facebook.com/${VENUE.profile.facebook.facebookId}`);
  });

  test('a venue to be announced is named without a link', async ({ page, api }) => {
    api.on(operation('Event'), { json: { events: { event: { ...EVENT, venue: { name: 'Secret warehouse', venue: null }, facebookId: null } } } });
    await page.goto(`/events/${EVENT.id}`);
    await expect(page.getByText('Venue to be announced.')).toBeVisible();
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
    await expect(page.locator('.ak-hero__image')).toHaveAttribute('src', PERSON_PAGE.bannerUrl);
    await expect(page.locator('.ak-hero__avatar')).toHaveText('AB');

    await expect(section(page, 'Upcoming').getByRole('link')).toHaveAttribute('href', `/events/${EVENT.id}`);

    const [song] = PERSON_PAGE.music.tracks.nodes;
    const track = section(page, 'Tracks').getByRole('link');
    await expect(track).toHaveAttribute('href', song.providerUrl);
    await expect(track.locator('.ak-card__title')).toHaveText(song.title);
    await expect(track.locator('.ak-card__meta')).toHaveText('SoundCloud');
    await expect(track.locator('img')).toHaveAttribute('src', `${IMAGES}/track.png`);

    // Social profiles first, then where their music is.
    await expect(page.locator('.ak-links a')).toHaveText(['Instagram @aurora', 'SoundCloud aurora']);
    await expect(page.locator('.ak-links a').first()).toHaveAttribute('href', 'https://www.instagram.com/aurora');
    await expect(page.getByRole('link', { name: 'View on Facebook' })).toHaveAttribute('href', `https://www.facebook.com/${PERSON.profile.facebook.facebookId}`);
  });

  test('says when someone has nothing coming up', async ({ page, api }) => {
    const solo = {
      id: PERSON.id, name: 'Solo', avatarUrl: null, bannerUrl: null,
      profile: { facebook: { facebookId: null }, socialLinks: connection() },
      events: { upcoming: connection() },
      music: { links: connection(), tracks: connection() },
    };
    api.on(operation('Person'), { json: { people: { person: solo } } });
    await page.goto(`/people/${PERSON.id}`);
    await expect(page.locator('.ak-hero')).toHaveClass(/ak-hero--plain/);
    await expect(section(page, 'Upcoming')).toContainText('No upcoming events.');
    await expect(section(page, 'Tracks')).toHaveCount(0);
    await expect(page.locator('.ak-links')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'View on Facebook' })).toHaveCount(0);
  });
});

test('a photo that fails to load is hidden instead of showing a broken image', async ({ page, api }) => {
  api.on(operation('ReportLocation'), { json: { reportLocation: { venue: null, locale: LOCALE, nearbyVenues: [{ ...VENUE, photoUrl: `${IMAGES}/broken.png` }] } } });
  await page.goto('/app/');
  const photo = section(page, 'Venues near you').locator('img');
  await expect(photo).toHaveCSS('visibility', 'hidden');
});
