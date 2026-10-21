// Mocks for the app suite: a stand-in Facebook JS SDK and an in-memory
// AudienceKit API, so the built site runs with no network. The records are
// shaped as the consumer GraphQL schema answers them (src/sdk/types.ts).
import { test as base, expect, type Page, type Request } from '@playwright/test';

export const API = 'https://api.audiencekit.com';
export const TOKEN = 'e2e.session.jwt';
export const AUDIENCE_ID = 'a0000000-0000-4000-8000-000000000000';
export const SEATTLE = { latitude: 47.6062, longitude: -122.3321 };

// Photos load from images.test; any URL with "broken" in it fails to load.
export const IMAGES = 'https://images.test';

/** A connection as the documents select it. */
export function connection<T>(...items: T[]) {
  return { nodes: items };
}

export const VENUE = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Neighbours',
  description: 'Capitol Hill\'s dance club since 1983.',
  photoUrl: `${IMAGES}/neighbours-place.png`,
  bannerUrl: `${IMAGES}/neighbours-banner.png`,
  distance: 120,
  profile: { address: '1509 Broadway, Seattle', phone: '+12063245358', facebook: { facebookId: '108155092546395' } },
};
export const PERSON = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Aurora Borealis',
  avatarUrl: null,
  profile: { facebook: { facebookId: '100064000000001' } },
};
export const EVENT = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Mess Hall Fridays',
  startAt: '2026-10-09T22:00:00-07:00',
  endAt: '2026-10-10T02:00:00-07:00',
  facebookId: '1234567890123',
  bannerUrl: null,
  rsvp: { mine: 'UNSURE' },
  venue: { name: VENUE.name, venue: VENUE },
  people: { lineup: connection(PERSON) },
};
export const PERSON_PAGE = {
  ...PERSON,
  bannerUrl: `${IMAGES}/aurora-banner.png`,
  events: { upcoming: connection(EVENT) },
  profile: { ...PERSON.profile, socialLinks: connection({ id: 's1', provider: 'instagram', handle: '@aurora', url: 'https://www.instagram.com/aurora' }) },
  music: {
    links: connection({ id: 's2', provider: 'soundcloud', handle: 'aurora', url: 'https://soundcloud.com/aurora' }),
    tracks: connection({ id: 't1', title: 'Northern Lights (Extended Mix)', provider: 'soundcloud', providerUrl: 'https://soundcloud.com/aurora/northern-lights', artworkUrl: `${IMAGES}/track.png` }),
  },
};
export const FRIENDS = [{ id: 'f1', name: 'Dana K.', avatarUrl: null, facebookId: null }, { id: 'f2', name: 'Sam Rivera', avatarUrl: null, facebookId: '100064000000002' }];

export const LOCALE = {
  id: 'l1',
  name: 'Seattle',
  label: 'Capitol Hill',
  bannerUrl: `${IMAGES}/capitol-hill.png`,
  events: { upcoming: connection(EVENT) },
  friends: { list: connection(...FRIENDS), venues: connection({ venue: { id: VENUE.id }, friendCount: 2 }) },
};

// What reportLocation answers when you're in the city but not at a venue.
export const NOW = { venue: null, locale: LOCALE, nearbyVenues: [VENUE] };

// The token JSON every sign-in answers (doc/TOKENS.md).
export const TOKEN_RESPONSE = {
  token: TOKEN,
  userId: 'u1',
  audienceId: AUDIENCE_ID,
  role: 'member',
  endpoint: `${API}/v1/audience/${AUDIENCE_ID}/graphql`,
  venueDeviceId: null,
  expiresAt: null,
};

type Reply = { status?: number; json?: unknown; errors?: { message: string; extensions?: Record<string, unknown> }[] };
type Handler = (request: Request) => Reply | Promise<Reply>;

// GraphQL operations are mocked by name ("Venue", "ReportLocation"); a reply's
// json is the operation's data, or its errors are the response's `errors`.
export function operation(name: string) {
  return `graphql ${name}`;
}

/** A GraphQL error with the API's code, as the server sends it. */
export function graphqlError(code: string, message = code, extensions: Record<string, unknown> = {}): Reply {
  return { errors: [{ message, extensions: { code, ...extensions } }] };
}

export class MockAPI {
  readonly requests: Request[] = [];
  private readonly handlers = new Map<string, Handler>();

  constructor() {
    this.on('POST /v1/token', () => ({ json: TOKEN_RESPONSE }));
    this.on('POST /v1/token/apple', () => ({ json: TOKEN_RESPONSE }));
    this.on('GET /v1/branding', () => ({ json: { audience: { id: AUDIENCE_ID, name: 'Hot Mess', subdomain: 'hotmess' } } }));
    this.on(operation('ReportLocation'), () => ({ json: { reportLocation: NOW } }));
    // Asking for any other ID finds nothing, as GraphQL answers for a deleted record.
    const byID = (id: string, record: unknown) => (request: Request) =>
      request.postDataJSON().variables.id === id ? record : null;
    this.on(operation('Venue'), (r) => ({ json: { venues: { venue: byID(VENUE.id, { ...VENUE, events: { upcoming: connection(EVENT) } })(r) } } }));
    this.on(operation('Event'), (r) => ({ json: { events: { event: byID(EVENT.id, EVENT)(r) } } }));
    this.on(operation('Person'), (r) => ({ json: { people: { person: byID(PERSON.id, PERSON_PAGE)(r) } } }));
  }

  // Replaces the reply for "METHOD /path" (no query string), or for a GraphQL
  // operation('Name').
  on(route: string, handler: Handler | Reply) {
    this.handlers.set(route, typeof handler === 'function' ? handler : () => handler);
  }

  calls(route: string) {
    return this.requests.filter((r) => MockAPI.key(r) === route);
  }

  // GraphQL requests are keyed by operation name, everything else by method and path.
  private static key(request: Request) {
    const route = `${request.method()} ${new URL(request.url()).pathname}`;
    return /^POST \/v1\/audience\/[^/]+\/graphql$/.test(route) ? operation(request.postDataJSON()?.operationName) : route;
  }

  async install(page: Page) {
    await page.route(`${API}/**`, async (route) => {
      const request = route.request();
      const cors = {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'Authorization, Content-Type, Accept, X-AudienceKit-API-Version',
        'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
        'access-control-expose-headers': 'X-AudienceKit-API-Version',
        'x-audiencekit-api-version': '2026-10-11',
      };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });

      this.requests.push(request);
      const key = MockAPI.key(request);
      const handler = this.handlers.get(key);
      const reply = handler ? await handler(request) : { status: 404, json: { error: 'NOT_FOUND', message: 'Not found' } };
      const graphql = key.startsWith('graphql ') && (reply.status ?? 200) < 400;
      const json = graphql
        ? (reply.errors ? { data: null, errors: reply.errors } : { data: reply.json ?? null })
        : reply.json ?? {};
      await route.fulfill({ status: reply.status ?? 200, headers: cors, contentType: 'application/json', json });
    });
  }
}

// A 1×1 PNG for every photo.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

// FB.login answers with window.__fbLogin (default: a signed-in user) and
// records the scope it was asked for in window.__fbScope.
const FACEBOOK_SDK = `
  window.FB = {
    init(options) { window.__fbInit = options; },
    login(callback, options) {
      window.__fbScope = options && options.scope;
      callback(window.__fbLogin ?? { authResponse: { accessToken: 'fb-user-token' } });
    },
  };
  window.fbAsyncInit && window.fbAsyncInit();
`;

// Sign in with Apple JS: init records its config in window.__appleInit (and
// every config in window.__appleInits), and
// signIn answers with window.__appleSignIn (default: a first sign-in, with the
// name), echoing the state, or rejects with window.__appleError. Like Safari,
// it refuses to open its popup unless the click is still being handled, so a
// sign-in that awaits anything between the click and signIn() fails.
const APPLE_SDK = `
  let clicking = false;
  addEventListener('click', () => { clicking = true; setTimeout(() => { clicking = false; }); }, true);
  window.AppleID = { auth: {
    init(config) { window.__appleInit = config; (window.__appleInits ??= []).push(config); },
    async signIn() {
      if (!clicking) throw { error: 'popup_blocked_by_browser' };
      if (window.__appleError) throw window.__appleError;
      const state = window.__appleState ?? window.__appleInit.state;
      return window.__appleSignIn ?? {
        authorization: { id_token: 'apple-identity-token', code: 'apple-code', state },
        user: { email: 'dana@example.com', name: { firstName: 'Dana', lastName: 'Kim' } },
      };
    },
  } };
`;

export const test = base.extend<{ api: MockAPI; signedIn: (token?: string, audienceId?: string | null) => Promise<void> }>({
  // Automatic, so no test can reach the network by forgetting to ask for it.
  api: [async ({ page }, use) => {
    const api = new MockAPI();
    // Anything not mocked below fails instead of reaching the network.
    await page.route((url) => url.hostname !== 'localhost', (route) => route.abort('blockedbyclient'));
    await page.route('https://connect.facebook.net/**', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: FACEBOOK_SDK }));
    await page.route('https://appleid.cdn-apple.com/**', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: APPLE_SDK }));
    await page.route('https://www.googletagmanager.com/**', (route) => route.abort());
    await page.route(`${IMAGES}/**`, (route) => route.request().url().includes('broken')
      ? route.fulfill({ status: 404 })
      : route.fulfill({ contentType: 'image/png', body: PNG }));
    await api.install(page);
    await use(api);
  }, { auto: true }],
  context: async ({ context }, use) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(SEATTLE);
    await use(context);
  },
  page: async ({ page }, use) => {
    // Any uncaught script error fails the test.
    const errors: Error[] = [];
    page.on('pageerror', (error) => errors.push(error));
    await use(page);
    expect(errors, 'uncaught page errors').toEqual([]);
  },
  // A session as the site stores it after sign-in: the token and the audience
  // the token JSON named (null for a session that didn't record one).
  signedIn: async ({ page }, use) => {
    await use(async (token = TOKEN, audienceId: string | null = AUDIENCE_ID) => {
      await page.addInitScript(([t, a]) => {
        localStorage.setItem('hotmess.token', t);
        if (a) localStorage.setItem('hotmess.audience', a); else localStorage.removeItem('hotmess.audience');
      }, [token, audienceId] as const);
    });
  },
});

// A titled list on a page ("Friends out tonight", "Upcoming"), found by its heading.
export function section(page: Page, title: string) {
  return page.locator('section.ak-section', { has: page.locator('h2', { hasText: new RegExp(`^${title}`) }) });
}

export { expect };
