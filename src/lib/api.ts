// A small client for the Hot Mess (AudienceKit) API, mirroring hot_mess_ios
// HotMess/Networking/HotMessAPI.swift: sign-in and branding are REST, and
// everything else goes through the audience's GraphQL endpoint, with fields
// aliased to the snake_case keys the views read.
import type { Event, Now, Person, Venue } from '../sdk/types';
import { API_BASE, AUDIENCE_HOST, AUDIENCEKIT_ENVIRONMENT, FACEBOOK_APP_ID } from './config';

const TOKEN_KEY = 'hotmess.token';
const DEVICE_KEY = 'hotmess.device';

export class APIError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export const session = {
  get token(): string | null { return storage()?.getItem(TOKEN_KEY) ?? null; },
  set token(value: string | null) {
    const s = storage();
    if (!s) return;
    if (value) s.setItem(TOKEN_KEY, value); else s.removeItem(TOKEN_KEY);
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

async function send<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (authenticated && session.token) headers.set('Authorization', `JWT ${session.token}`);
  if (AUDIENCEKIT_ENVIRONMENT === 'staging') headers.set('X-AudienceKit-Environment', 'staging');

  const response = await fetch(new URL(path, API_BASE), { ...init, headers });
  if (response.status === 401) session.token = null;
  if (!response.ok) throw new APIError(response.status, `${init.method ?? 'GET'} ${path} failed with ${response.status}`);
  return response.status === 204 ? (undefined as T) : response.json();
}

export type { Event, Now, Person, Venue } from '../sdk/types';

// The audience a session belongs to: the audience_id claim of a JWT signed in
// on the audience's host, else the audience that owns AUDIENCE_HOST.
function claimedAudience(token: string | null): string | undefined {
  const payload = token?.split('.')[1];
  if (!payload) return undefined;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof claims.audience_id === 'string' ? claims.audience_id : undefined;
  } catch {
    return undefined;
  }
}

let brandedAudience: Promise<string> | undefined;

function audienceID(): Promise<string> {
  const claimed = claimedAudience(session.token);
  if (claimed) return Promise.resolve(claimed);
  brandedAudience ??= send<{ audience: { id: string } }>(`/v1/branding?${new URLSearchParams({ host: AUDIENCE_HOST })}`, {}, false)
    .then((r) => r.audience.id)
    .catch((e) => { brandedAudience = undefined; throw e; });
  return brandedAudience;
}

async function graphql<T>(document: string, variables: Record<string, unknown>): Promise<T> {
  const operation = /^\s*(?:query|mutation)\s+(\w+)/.exec(document)?.[1] ?? 'graphql';
  const path = `/v1/audience/${await audienceID()}/graphql`;
  const result = await send<{ data?: T; errors?: { message: string }[] }>(path, {
    method: 'POST',
    body: JSON.stringify({ query: document, variables, operationName: operation }),
  });
  if (result.errors?.length) throw new APIError(500, `${operation} failed: ${result.errors.map((e) => e.message).join(', ')}`);
  if (!result.data) throw new APIError(500, `${operation} returned no data`);
  return result.data;
}

function found<T>(value: T | null | undefined): T {
  if (value == null) throw new APIError(404, 'Not found');
  return value;
}

const VENUE = 'id name address phone distance description facebook_id: facebookId photo_url: photoUrl hero_url: heroUrl';
const PERSON = 'id name facebook_id: facebookId photo_url: pictureUrl';
const EVENT = `id name start_at: startAt end_at: endAt facebook_id: facebookId cover_photo_url: coverPhotoUrl
  rsvp: viewerRsvp venue_name: venueName venue { ${VENUE} } people { ${PERSON} }`;

// Lists name an event's first act as its host ("with Aurora").
function withHost(event: Event): Event {
  return event.person || !event.people?.length ? event : { ...event, person: event.people[0] };
}

const NOW = `mutation ReportLocation($position: CoordinatesInput!) {
  reportLocation(input: { position: $position }) {
    now {
      title image_url: imageUrl
      locale { id name }
      venue { ${VENUE} }
      venues { ${VENUE} }
      events { ${EVENT} }
      friends { id name facebook_id: facebookId }
      friend_venues: friendVenues { venue { id } friend_count: friendCount }
    }
  }
}`;

const VENUE_PAGE = `query Venue($id: ID!) {
  venue(id: $id) { ${VENUE} events { ${EVENT} } }
}`;

const EVENT_PAGE = `query Event($id: ID!) {
  event(id: $id) { ${EVENT} }
}`;

const PERSON_PAGE = `query Person($id: ID!) {
  person(id: $id) {
    ${PERSON} cover_url: coverUrl
    events { ${EVENT} }
    social_links: socialLinks { id handle provider url }
    tracks { id title provider provider_url: providerUrl artwork_url: artworkUrl }
  }
}`;

type FriendVenue = { venue: { id: string }; friend_count: number };

export const api = {
  signIn: (facebookToken: string) =>
    send<{ token: string; user: { id: string; name: string } }>('/v1/token', {
      method: 'POST',
      body: JSON.stringify({
        facebook_token: facebookToken,
        // host picks the audience; facebook_app_id is the app the token is for.
        host: AUDIENCE_HOST,
        facebook_app_id: FACEBOOK_APP_ID,
        device: {
          type: 'web',
          identifier: deviceIdentifier(),
          version: '1.0',
          build: '1',
          model: navigator.userAgent.slice(0, 120),
        },
      }),
    }, false),
  // Records where you are, which is how the API knows the venue you're at.
  now: async (latitude: number, longitude: number): Promise<Now> => {
    const data = await graphql<{ reportLocation: { now: Now & { friend_venues?: FriendVenue[] } } }>(NOW, { position: { latitude, longitude } });
    const { friend_venues: friendVenues = [], ...now } = data.reportLocation.now;
    const friendCount = new Map(friendVenues.map((f) => [f.venue.id, f.friend_count]));
    return {
      ...now,
      events: now.events?.map(withHost),
      venues: now.venues?.map((venue) => ({ ...venue, friend_count: friendCount.get(venue.id) ?? 0 })),
    };
  },
  // A venue and its upcoming events, in one request.
  venue: async (id: string): Promise<{ venue: Venue; events: Event[] }> => {
    const { events, ...venue } = found((await graphql<{ venue: (Venue & { events?: Event[] }) | null }>(VENUE_PAGE, { id })).venue);
    return { venue, events: (events ?? []).map(withHost) };
  },
  event: async (id: string): Promise<Event> =>
    found((await graphql<{ event: Event | null }>(EVENT_PAGE, { id })).event),
  person: async (id: string): Promise<Person> => {
    const person = found((await graphql<{ person: Person | null }>(PERSON_PAGE, { id })).person);
    return { ...person, events: person.events?.map(withHost) };
  },
};
