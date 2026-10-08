// A real Hot Mess session for the live suite, from one of:
//
//   HOTMESS_E2E_TOKEN    an AudienceKit session JWT, used as is.
//   FB_TEST_APP_ID +     the app the Facebook test users belong to
//   FB_TEST_APP_SECRET   (713525445368431, the AudienceKit platform app). The
//                        suite asks the Graph API for a test user's access
//                        token and signs in through POST /v1/token, like the
//                        site does. FB_TEST_USER_ID picks the test user
//                        (default: the web test user).
//
// With neither, the signed-in tests are skipped.
export const API_BASE = process.env.E2E_API_BASE ?? 'https://api.audiencekit.com';
const AUDIENCE_HOST = process.env.E2E_AUDIENCE_HOST ?? 'hotmess.admin.audiencekit.com';
const GRAPH = 'https://graph.facebook.com/v26.0';
const WEB_TEST_USER = '109133112959777';

export const canSignIn = !!(process.env.HOTMESS_E2E_TOKEN || (process.env.FB_TEST_APP_ID && process.env.FB_TEST_APP_SECRET));

async function json(response: Response, what: string) {
  const body = await response.text();
  if (!response.ok) throw new Error(`${what} failed with ${response.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body);
}

async function testUserAccessToken(appId: string, secret: string): Promise<string> {
  const userId = process.env.FB_TEST_USER_ID ?? WEB_TEST_USER;
  const appToken = `${appId}|${secret}`;
  let url: string | undefined = `${GRAPH}/${appId}/accounts/test-users?${new URLSearchParams({ access_token: appToken, limit: '100' })}`;
  while (url) {
    const page: { data: { id: string; access_token?: string }[]; paging?: { next?: string } } =
      await json(await fetch(url), 'Listing Facebook test users');
    const user = page.data.find((u) => u.id === userId);
    if (user?.access_token) return user.access_token;
    if (user) throw new Error(`Facebook test user ${userId} has no access token (the app isn't installed for it)`);
    url = page.paging?.next;
  }
  throw new Error(`Facebook test user ${userId} isn't a test user of app ${appId}`);
}

let cached: Promise<string> | undefined;

export function sessionToken(): Promise<string> {
  cached ??= (async () => {
    if (process.env.HOTMESS_E2E_TOKEN) return process.env.HOTMESS_E2E_TOKEN;
    const appId = process.env.FB_TEST_APP_ID!;
    const facebookToken = await testUserAccessToken(appId, process.env.FB_TEST_APP_SECRET!);
    const response = await fetch(new URL('/v1/token', API_BASE), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        facebook_token: facebookToken,
        host: AUDIENCE_HOST,
        facebook_app_id: appId,
        // One fixed device, so scheduled runs don't pile up devices.
        device: { type: 'web', identifier: 'hotmess-social-e2e-live', version: '1.0', build: '1', model: 'Playwright' },
      }),
    });
    return (await json(response, 'POST /v1/token')).token;
  })();
  return cached;
}
