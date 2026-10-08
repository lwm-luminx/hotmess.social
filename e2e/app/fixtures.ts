// Mocks for the app suite: a stand-in Facebook JS SDK and an in-memory
// AudienceKit API, so the built site runs with no network.
import { test as base, expect, type Page, type Request } from '@playwright/test';

export const API = 'https://api.audiencekit.com';
export const TOKEN = 'e2e.session.jwt';
export const SEATTLE = { latitude: 47.6062, longitude: -122.3321 };

// Photos load from images.test; any URL with "broken" in it fails to load.
export const IMAGES = 'https://images.test';

export const VENUE = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Neighbours',
  address: '1509 Broadway, Seattle',
  phone: '+12063245358',
  description: 'Capitol Hill\'s dance club since 1983.',
  facebook_id: '108155092546395',
  photo_url: `${IMAGES}/neighbours-page.png`,
  hero_url: `${IMAGES}/neighbours-hero.png`,
  distance: 120,
};
export const PERSON = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Aurora Borealis',
  role: 'DJ',
  facebook_id: '100064000000001',
  photo_url: null,
  cover_url: `${IMAGES}/aurora-cover.png`,
};
export const EVENT = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Mess Hall Fridays',
  start_at: '2026-10-09T22:00:00-07:00',
  end_at: '2026-10-10T02:00:00-07:00',
  facebook_id: '1234567890123',
  venue: VENUE,
  person: { id: PERSON.id, name: PERSON.name },
};
// How the API renders an event on its own page: everyone on the bill.
export const EVENT_PAGE = { ...EVENT, people: [{ id: PERSON.id, name: PERSON.name, role: 'DJ' }] };
export const PERSON_PAGE = {
  ...PERSON,
  events: [EVENT],
  social_links: [{ id: 's1', provider: 'instagram', handle: '@aurora', url: 'https://www.instagram.com/aurora' }],
  tracks: [{ id: 't1', title: 'Northern Lights (Extended Mix)', provider: 'soundcloud', provider_url: 'https://soundcloud.com/aurora/northern-lights', artwork_url: `${IMAGES}/track.png` }],
};
export const FRIENDS = [{ id: 'f1', name: 'Dana K.' }, { id: 'f2', name: 'Sam Rivera' }];

export const NOW = {
  title: 'Capitol Hill',
  image_url: `${IMAGES}/capitol-hill.png`,
  locale: { id: 'l1', name: 'Seattle' },
  events: [EVENT],
  venues: [VENUE],
  friends: FRIENDS,
  friend_venues: [{ venue: { id: VENUE.id }, friend_count: 2 }],
};

type Reply = { status?: number; json?: unknown };
type Handler = (request: Request) => Reply | Promise<Reply>;

export const AUDIENCE_ID = 'a0000000-0000-4000-8000-000000000000';

// GraphQL operations are mocked by name ("Venue", "ReportLocation"); a reply's
// json is the operation's data.
export function operation(name: string) {
  return `graphql ${name}`;
}

export class MockAPI {
  readonly requests: Request[] = [];
  private readonly handlers = new Map<string, Handler>();

  constructor() {
    this.on('POST /v1/token', () => ({ json: { token: TOKEN, user: { id: 'u1', name: 'Dave S.' } } }));
    this.on('GET /v1/branding', () => ({ json: { audience: { id: AUDIENCE_ID, name: 'Hot Mess', subdomain: 'hotmess' } } }));
    this.on(operation('ReportLocation'), () => ({ json: { reportLocation: { now: NOW } } }));
    // Asking for any other ID finds nothing, as GraphQL answers for a deleted record.
    const byID = (id: string, record: unknown) => (request: Request) =>
      request.postDataJSON().variables.id === id ? record : null;
    this.on(operation('Venue'), (r) => ({ json: { venue: byID(VENUE.id, { ...VENUE, events: [EVENT] })(r) } }));
    this.on(operation('Event'), (r) => ({ json: { event: byID(EVENT.id, EVENT_PAGE)(r) } }));
    this.on(operation('Person'), (r) => ({ json: { person: byID(PERSON.id, PERSON_PAGE)(r) } }));
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
        'access-control-allow-headers': 'Authorization, Content-Type, Accept, X-AudienceKit-Environment',
        'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
      };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });

      this.requests.push(request);
      const key = MockAPI.key(request);
      const handler = this.handlers.get(key);
      const reply = handler ? await handler(request) : { status: 404, json: {} };
      const json = key.startsWith('graphql ') && (reply.status ?? 200) < 400 ? { data: reply.json ?? null } : reply.json ?? {};
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

export const test = base.extend<{ api: MockAPI; signedIn: (token?: string) => Promise<void> }>({
  // Automatic, so no test can reach the network by forgetting to ask for it.
  api: [async ({ page }, use) => {
    const api = new MockAPI();
    // Anything not mocked below fails instead of reaching the network.
    await page.route((url) => url.hostname !== 'localhost', (route) => route.abort('blockedbyclient'));
    await page.route('https://connect.facebook.net/**', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: FACEBOOK_SDK }));
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
  signedIn: async ({ page }, use) => {
    await use(async (token = TOKEN) => {
      await page.addInitScript((t) => localStorage.setItem('hotmess.token', t), token);
    });
  },
});

// A titled list on a page ("Friends out tonight", "Upcoming"), found by its heading.
export function section(page: Page, title: string) {
  return page.locator('section.ak-section', { has: page.locator('h2', { hasText: new RegExp(`^${title}`) }) });
}

export { expect };
