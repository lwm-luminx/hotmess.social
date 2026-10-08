import { test, expect, EVENT, PERSON, VENUE } from './fixtures';

// Share links are served by the 404 page, as on GitHub Pages.
test.describe('signed in', () => {
  test.beforeEach(async ({ signedIn }) => { await signedIn(); });

  for (const [path, title] of [[`/venues/${VENUE.id}`, VENUE.name], [`/events/${EVENT.id}`, EVENT.name], [`/people/${PERSON.id}`, PERSON.name]]) {
    test(`${path.split('/')[1]} links open in the app`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('.ak-hero h1')).toHaveText(title);
      await expect(page).toHaveTitle(`${title} · Hot Mess`);
    });
  }

  test('upper-case ids open the same page', async ({ page, api }) => {
    await page.goto(`/people/${PERSON.id.toUpperCase()}`);
    await expect(page.locator('.ak-hero h1')).toHaveText(PERSON.name);
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
  await expect(page.locator('.ak-hero h1')).toHaveText(VENUE.name);
  expect(api.calls('GET /v1/now')).toEqual([]);
});
