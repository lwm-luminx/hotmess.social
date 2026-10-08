import { test, expect, VENUE } from './fixtures';

const REPORTS = 'POST /v1/client_errors';

function reports(api: { calls: (route: string) => { postData: () => string | null }[] }) {
  return api.calls(REPORTS).map((request) => JSON.parse(request.postData() ?? '{}'));
}

test('uncaught errors and rejections are reported to the API', async ({ page, api }) => {
  await page.goto('/');
  await page.evaluate(() => {
    dispatchEvent(new ErrorEvent('error', { error: new TypeError('boom'), message: 'boom', filename: 'app.js', lineno: 3 }));
    dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { promise: Promise.resolve(), reason: 'nope' }));
  });

  await expect.poll(() => api.calls(REPORTS).length).toBe(2);
  expect(reports(api)).toEqual([
    expect.objectContaining({ app: 'hotmess.social', kind: 'error', message: 'TypeError: boom', source: 'app.js', line: 3 }),
    expect.objectContaining({ app: 'hotmess.social', kind: 'unhandledrejection', message: 'nope' }),
  ]);
});

test('a view that fails to render is reported and offers a reload', async ({ page, api, signedIn }) => {
  await signedIn();
  api.on(`GET /v1/venues/${VENUE.id}`, () => ({ json: { venue: null } }));

  await page.goto(`/venues/${VENUE.id}`);

  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
  await expect.poll(() => api.calls(REPORTS).length).toBe(1);
  expect(reports(api)[0]).toMatchObject({ app: 'hotmess.social', kind: 'boundary' });
  expect(reports(api)[0].component_stack).toBeTruthy();
});
