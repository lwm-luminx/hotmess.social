import { test, expect, EVENT, PERSON, VENUE } from './fixtures';

// Share links are served by the 404 page, as on GitHub Pages.
test.describe('signed in', () => {
  test.beforeEach(async ({ signedIn }) => { await signedIn(); });

  test('a venue link shows the venue and what\'s coming up', async ({ page }) => {
    await page.goto(`/venues/${VENUE.id}`);
    await expect(page.getByRole('heading', { level: 1, name: VENUE.name })).toBeVisible();
    await expect(page.getByText(VENUE.address)).toBeVisible();
    await expect(page).toHaveTitle(`${VENUE.name} · Hot Mess`);
    const upcoming = page.locator('section', { has: page.getByRole('heading', { name: 'Upcoming' }) });
    await expect(upcoming.getByRole('link', { name: new RegExp(EVENT.name) })).toHaveAttribute('href', `/events/${EVENT.id}`);
  });

  test('an event link shows the event and where it is', async ({ page }) => {
    await page.goto(`/events/${EVENT.id}`);
    await expect(page.getByRole('heading', { level: 1, name: EVENT.name })).toBeVisible();
    await expect(page.getByText('Fri, Oct 9, 10:00 PM')).toBeVisible();
    const where = page.locator('section', { has: page.getByRole('heading', { name: 'Where' }) });
    await expect(where.getByRole('link')).toHaveAttribute('href', `/venues/${VENUE.id}`);
  });

  test('a person link shows the person', async ({ page }) => {
    await page.goto(`/people/${PERSON.id}`);
    await expect(page.getByRole('heading', { level: 1, name: PERSON.name })).toBeVisible();
    await expect(page).toHaveTitle(`${PERSON.name} · Hot Mess`);
  });

  test('upper-case ids open the same page', async ({ page, api }) => {
    await page.goto(`/people/${PERSON.id.toUpperCase()}`);
    await expect(page.getByRole('heading', { level: 1, name: PERSON.name })).toBeVisible();
    expect(api.calls(`GET /v1/people/${PERSON.id}`)).toHaveLength(1);
  });

  test('a link to something deleted says it can\'t be found', async ({ page }) => {
    await page.goto('/events/44444444-4444-4444-8444-444444444444');
    await expect(page.getByText("We couldn't find that.")).toBeVisible();
  });

  test('a malformed link says the page doesn\'t exist', async ({ page, api }) => {
    await page.goto('/venues/not-a-uuid');
    await expect(page.getByText("That page doesn't exist.")).toBeVisible();
    expect(api.requests).toEqual([]);
  });
});

test('a share link asks to sign in first', async ({ page, api }) => {
  await page.goto(`/venues/${VENUE.id}`);
  await expect(page.getByRole('heading', { name: 'Sign in to Hot Mess' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue with Facebook' }).click();
  await expect(page.getByRole('heading', { level: 1, name: VENUE.name })).toBeVisible();
  expect(api.calls('GET /v1/now')).toEqual([]);
});
