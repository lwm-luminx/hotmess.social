// A small client for the Hot Mess (AudienceKit) API, mirroring hot_mess_ios
// HotMess/Networking/HotMessAPI.swift: sign-in and branding are REST, and
// everything else goes through the audience's GraphQL endpoint. The documents
// below are validated against the API's schema in CI
// (.github/workflows/graphql-documents.yml); src/sdk/types.ts mirrors them.
import type { Event, Now, Person, TokenResponse, Venue } from '../sdk/types';
import { nodes } from '../sdk/format';
import { API_BASE, AUDIENCE_HOST, FACEBOOK_APP_ID } from './config';
import { APIError, graphqlError, restError, type GraphQLError } from './apiErrors';
import type { AppleSignIn } from './apple';

// The sign-in methods an audience offers, and what to say before each one
// that has a warning (shown with Cancel and Continue).
export type SignInMethods = { methods: string[]; warnings: Record<string, string> };

export { APIError } from './apiErrors';

// The date the API contract was last broken (doc/TOKENS.md). Sent on every
// request; the API refuses a version it no longer serves with 400.
export const API_VERSION = '2026-10-11';

const TOKEN_KEY = 'hotmess.token';
const AUDIENCE_KEY = 'hotmess.audience';
const DEVICE_KEY = 'hotmess.device';

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

function stored(key: string, value: string | null) {
  const s = storage();
  if (!s) return;
  if (value) s.setItem(key, value); else s.removeItem(key);
}

// The session: the JWT and, from the token JSON it came with, the audience
// it was signed in on. Nothing here decodes the JWT.
export const session = {
  get token(): string | null { return storage()?.getItem(TOKEN_KEY) ?? null; },
  get audienceId(): string | null { return storage()?.getItem(AUDIENCE_KEY) ?? null; },
  start(response: Pick<TokenResponse, 'token' | 'audienceId'>) {
    stored(TOKEN_KEY, response.token);
    stored(AUDIENCE_KEY, response.audienceId);
  },
  end() {
    stored(TOKEN_KEY, null);
    stored(AUDIENCE_KEY, null);
  },
};

// The API keys sessions by device, so a browser gets a stable identifier.
function deviceIdentifier(): string {
  const s = storage();
  let id = s?.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    s?.setItem(DEVICE_KEY, id);
  }
  return id;
}

function device() {
  return {
    type: 'web',
    identifier: deviceIdentifier(),
    version: '1.0',
    build: '1',
    model: navigator.userAgent.slice(0, 120),
  };
}

async function send<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('X-AudienceKit-API-Version', API_VERSION);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (authenticated && session.token) headers.set('Authorization', `Bearer ${session.token}`);

  const response = await fetch(new URL(path, API_BASE), { ...init, headers });
  if (response.status === 401) session.end();
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw restError(init.method ?? 'GET', path, response.status, body);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export type { Event, Now, Person, Venue } from '../sdk/types';

let brandedAudience: Promise<string> | undefined;

// The audience a session belongs to: the one its sign-in named, else the
// audience that owns AUDIENCE_HOST.
function audienceID(): Promise<string> {
  const named = session.audienceId;
  if (named) return Promise.resolve(named);
  brandedAudience ??= send<{ audience: { id: string } }>(`/v1/branding?${new URLSearchParams({ host: AUDIENCE_HOST })}`, {}, false)
    .then((r) => r.audience.id)
    .catch((e) => { brandedAudience = undefined; throw e; });
  return brandedAudience;
}

export async function graphql<T>(document: string, variables: Record<string, unknown>): Promise<T> {
  const operation = /^\s*(?:query|mutation)\s+(\w+)/.exec(document)?.[1] ?? 'graphql';
  const path = `/v1/audience/${await audienceID()}/graphql`;
  const result = await send<{ data?: T; errors?: GraphQLError[] }>(path, {
    method: 'POST',
    body: JSON.stringify({ query: document, variables, operationName: operation }),
  });
  if (result.errors?.length) {
    const error = graphqlError(operation, result.errors);
    if (error.signedOut) session.end();
    throw error;
  }
  if (!result.data) throw new APIError(500, `${operation} returned no data`);
  return result.data;
}

function found<T>(value: T | null | undefined): T {
  if (value == null) throw new APIError(404, 'Not found', 'NOT_FOUND');
  return value;
}

// Fragments. A venue's address, phone and Facebook Page live on its listing
// profile; a person's Facebook Page likewise.
const VENUE = 'id name distance description photoUrl bannerUrl profile { address phone facebook { facebookId link } }';
const PERSON = 'id name avatarUrl profile { facebook { facebookId link } }';
const FRIEND = 'id name avatarUrl facebookId';
const EVENT = `id name startAt endAt facebookId bannerUrl rsvp { mine }
  venue { name venue { ${VENUE} } } people { hosts { nodes { ${PERSON} } } lineup { nodes { ${PERSON} } } }`;
const LINK = 'id handle provider url';

// Where you are: the venue when you're at one, else your locale and its
// nearest venues. Tonight's events and your friends out come from the locale.
const NOW = `mutation ReportLocation($position: CoordinatesInput!) {
  reportLocation(input: { position: $position }) {
    venue { ${VENUE} }
    locale {
      id name label bannerUrl
      events { upcoming { nodes { ${EVENT} } } }
      friends { list { nodes { ${FRIEND} } } venues { nodes { venue { id } friendCount } } }
    }
    nearbyVenues { ${VENUE} }
  }
}`;

const VENUE_PAGE = `query Venue($id: ID!) {
  venues { venue(id: $id) { ${VENUE} events { upcoming { nodes { ${EVENT} } } } ordering { url } } }
}`;

const EVENT_PAGE = `query Event($id: ID!) {
  events { event(id: $id) { ${EVENT} } }
}`;

const PERSON_PAGE = `query Person($id: ID!) {
  people {
    person(id: $id) {
      ${PERSON} bannerUrl
      events { upcoming { nodes { ${EVENT} } } }
      profile { socialLinks { nodes { ${LINK} } } }
      music { links { nodes { ${LINK} } } tracks { nodes { id title provider providerUrl streamUrl artworkUrl } } }
    }
  }
}`;

// A post as its shared link shows it to someone signed in: comments stay in the app.
const POST_PAGE = `query Post($id: ID!) {
  posts {
    post(id: $id) {
      id body posterName posterAvatarUrl actingPersonName createdAt edited
      photos { url altText } event { id name startAt } person { id } venue { id }
    }
  }
}`;

// The poster builder (src/components/poster/) looks a venue or event up by name, and fills the poster from the one
// picked, with a share link that opens for a year (a printed poster's lifetime).
const POSTER_VENUE = 'id name locale { name } profile { address }';
const POSTER_EVENT = 'id name startAt endAt venue { name venue { id name locale { name } } }';

const POSTER_SEARCH = `query PosterSearch($search: String!) {
  venues { list(search: $search, first: 6) { nodes { ${POSTER_VENUE} } } }
  events { list(search: $search, first: 6) { nodes { ${POSTER_EVENT} } } }
}`;

const POSTER_VENUE_LISTING = `query PosterVenue($id: ID!, $path: String!) {
  venues { venue(id: $id) { ${POSTER_VENUE} } }
  shareLink(path: $path, lifetime: YEAR) { url }
}`;

const POSTER_EVENT_LISTING = `query PosterEvent($id: ID!, $path: String!) {
  events { event(id: $id) { ${POSTER_EVENT} } }
  shareLink(path: $path, lifetime: YEAR) { url }
}`;

export interface PosterVenue {
  id: string;
  name: string | null;
  locale: { name: string | null } | null;
  profile: { address: string | null } | null;
}

export interface PosterEvent {
  id: string;
  name: string | null;
  startAt: string | null;
  endAt: string | null;
  venue: { name: string | null; venue: { id: string; name: string | null; locale: { name: string | null } | null } | null } | null;
}

export interface Post {
  id: string;
  body: string | null;
  posterName: string | null;
  posterAvatarUrl: string | null;
  actingPersonName: string | null;
  createdAt: string | null;
  edited: boolean | null;
  photos: { url: string | null; altText: string | null }[] | null;
  event: { id: string; name: string | null; startAt: string | null } | null;
  person: { id: string } | null;
  venue: { id: string } | null;
}

export const api = {
  // Answers the token JSON (doc/TOKENS.md). A token Facebook refuses is 400
  // INVALID with Facebook's reason as the message; 401 means the app or
  // audience refused it.
  signIn: (facebookToken: string) =>
    send<TokenResponse>('/v1/token', {
      method: 'POST',
      body: JSON.stringify({
        facebook_token: facebookToken,
        // host picks the audience; facebook_app_id is the app the token is for.
        host: AUDIENCE_HOST,
        facebook_app_id: FACEBOOK_APP_ID,
        device: device(),
      }),
    }, false),
  // Signs in with Apple's identity token (POST /v1/token/apple). A token Apple
  // didn't vouch for, or whose nonce doesn't match, is 401.
  signInWithApple: (apple: AppleSignIn) =>
    send<TokenResponse>('/v1/token/apple', {
      method: 'POST',
      body: JSON.stringify({
        identity_token: apple.identityToken,
        authorization_code: apple.authorizationCode,
        first_name: apple.firstName,
        last_name: apple.lastName,
        redirect_uri: apple.redirectUri,
        nonce: apple.nonce,
        host: AUDIENCE_HOST,
        device: device(),
      }),
    }, false),
  // The ways the audience lets people sign in (GET /v1/token/methods), which
  // AudienceKit's admin chooses, with the warning to show before each one that
  // has one, or null when the API can't say (an API from before the setting
  // answers 404): the sign-in card then shows Facebook with no warning.
  signInMethods: async (): Promise<SignInMethods | null> => {
    try {
      const query = new URLSearchParams({ host: AUDIENCE_HOST });
      const answer = await send<{ methods?: string[]; warnings?: Record<string, string> }>(`/v1/token/methods?${query}`, {}, false);
      return answer.methods ? { methods: answer.methods, warnings: answer.warnings ?? {} } : null;
    } catch {
      return null;
    }
  },
  // Whether a signed share link (?e=) has expired or been tampered with, which GET /v1/share answers with 410
  // (audience-kit api/doc/SHARE_CARDS.md). Anything else, a network failure included, opens the link as before.
  shareLinkExpired: async (path: string, e: string): Promise<boolean> => {
    try {
      await send(`/v1/share?${new URLSearchParams({ host: location.hostname, path, e })}`, {}, false);
      return false;
    } catch (error) {
      return error instanceof APIError && error.status === 410;
    }
  },
  // Records where you are, which is how the API knows the venue you're at.
  now: async (latitude: number, longitude: number): Promise<Now> =>
    (await graphql<{ reportLocation: Now }>(NOW, { position: { latitude, longitude } })).reportLocation,
  // A venue and its upcoming events, in one request.
  venue: async (id: string): Promise<{ venue: Venue; events: Event[] }> => {
    const { events, ...venue } = found((await graphql<{ venues: { venue: Venue | null } }>(VENUE_PAGE, { id })).venues.venue);
    return { venue, events: nodes(events?.upcoming) };
  },
  event: async (id: string): Promise<Event> =>
    found((await graphql<{ events: { event: Event | null } }>(EVENT_PAGE, { id })).events.event),
  person: async (id: string): Promise<Person> =>
    found((await graphql<{ people: { person: Person | null } }>(PERSON_PAGE, { id })).people.person),
  post: async (id: string): Promise<Post> =>
    found((await graphql<{ posts: { post: Post | null } }>(POST_PAGE, { id })).posts.post),
  // Venues (visible ones, by name) and upcoming events (by their name or their venue's) matching a search.
  posterSearch: async (search: string): Promise<{ venues: PosterVenue[]; events: PosterEvent[] }> => {
    const result = await graphql<{ venues: { list: { nodes: PosterVenue[] } }; events: { list: { nodes: PosterEvent[] } } }>(
      POSTER_SEARCH, { search });
    return { venues: result.venues.list.nodes, events: result.events.list.nodes };
  },
  // A venue or event for a poster, and the link its QR code opens; null for a link the API won't sign.
  posterVenue: async (id: string): Promise<{ venue: PosterVenue; link: string | null }> => {
    const result = await graphql<{ venues: { venue: PosterVenue | null }; shareLink: { url: string } | null }>(
      POSTER_VENUE_LISTING, { id, path: `/venues/${id}` });
    return { venue: found(result.venues.venue), link: result.shareLink?.url ?? null };
  },
  posterEvent: async (id: string): Promise<{ event: PosterEvent; link: string | null }> => {
    const result = await graphql<{ events: { event: PosterEvent | null }; shareLink: { url: string } | null }>(
      POSTER_EVENT_LISTING, { id, path: `/events/${id}` });
    return { event: found(result.events.event), link: result.shareLink?.url ?? null };
  },
};
