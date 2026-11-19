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
  await page.getByRole('button', { name: 'I need food' }).click();
  await expect(page.getByRole('heading', { name: 'Support line' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Cathedral Kitchen' })).toBeVisible();
});

test('an unknown city is a 404 that points to every city', async ({ page }) => {
  const response = await page.goto('/resources/atlantis');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('link', { name: 'See every city' })).toBeVisible();
});
