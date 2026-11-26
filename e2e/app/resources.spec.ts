import { test, expect } from '@playwright/test';

test('the help directory lists cities live from the API', async ({ page }) => {
  await page.goto('/resources');
  await expect(page.getByRole('heading', { name: 'Help in your city' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'United States' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Canada' })).toBeVisible();
  await page.getByRole('link', { name: 'Seattle' }).click();
  await expect(page).toHaveURL(/\/resources\/seattle$/);
});

test("a city's directory filters by need, and keeps DV resources neutral", async ({ page }) => {
  await page.goto('/resources/Seattle');
  await expect(page).toHaveURL(/\/resources\/seattle$/);
  await expect(page.getByRole('heading', { name: 'Find help in Seattle' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Support line' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The NW Network' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Call (206) 568-7777' })).toHaveAttribute('href', 'tel:+12065687777');
  await expect(page.getByText('Mon–Fri, 5pm–7pm')).toBeVisible();
  // Short labels under "I need…", and only the needs with something listed here.
  const needs = page.getByRole('group', { name: 'I need…' });
  await expect(needs.getByRole('button')).toHaveText(['Everything', 'Food', 'Safety at home']);
  await expect(page.getByRole('status')).toHaveText('2 places');
  await needs.getByRole('button', { name: 'Food' }).click();
  await expect(needs.getByRole('button', { name: 'Food' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Support line' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Cathedral Kitchen' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('1 place');
});

test('searching a city filters on the device, and an empty result offers a way back', async ({ page }) => {
  await page.goto('/resources/seattle');
  await expect(page.getByRole('link', { name: 'Call 911' })).toHaveAttribute('href', 'tel:911');
  const search = page.getByRole('searchbox', { name: 'Search this list' });
  await search.fill('dinner');
  await expect(page.getByRole('heading', { name: 'Cathedral Kitchen' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Support line' })).toBeHidden();
  await search.fill('nothing like this');
  await expect(page.getByText('Nothing listed here matches that.')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('0 places');
  await page.getByRole('button', { name: 'Show everything' }).click();
  await expect(search).toHaveValue('');
  await expect(page.getByRole('status')).toHaveText('2 places');
});

test('the city list narrows as you type', async ({ page }) => {
  await page.goto('/resources');
  await page.getByRole('searchbox', { name: 'Find your city' }).fill('tor');
  await expect(page.getByRole('link', { name: 'Toronto' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Seattle' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'United States' })).toBeHidden();
});

test('an unknown city is a 404 that points to every city', async ({ page }) => {
  const response = await page.goto('/resources/atlantis');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('link', { name: 'See every city' })).toBeVisible();
});
