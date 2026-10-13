// A small client for the Hot Mess (AudienceKit) API, mirroring hot_mess_ios
// HotMess/Networking/HotMessAPI.swift: sign-in and branding are REST, and
// everything else goes through the audience's GraphQL endpoint, with fields
// aliased to the snake_case keys the views read.
import type { Event, Friend, Now, Person, PersonReference, SocialLink, Track, Venue } from '../sdk/types';
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

// A venue's address, phone and Facebook Page, and a person's Page, come
// through their profile mixin; decodeVenue and decodePerson flatten it.
const VENUE = `id name distance description photo_url: photoUrl hero_url: heroUrl
  profile { address phone facebook { facebook_id: facebookId facebook_url: link } }`;
const PERSON = 'id name photo_url: pictureUrl profile { facebook { facebook_id: facebookId facebook_url: link } }';
// An event's venue comes through its venues mixin: its name, or "To be
// announced", and the venue, if any. Its lineup comes through its people mixin.
const EVENT = `id name start_at: startAt end_at: endAt facebook_id: facebookId banner_url: bannerUrl
  rsvp: viewerRsvp venue { name venue { ${VENUE} } } people { lineup { nodes { ${PERSON} } } }`;

// Events, venues, music and profile mixins as GraphQL sends them; decodeEvent,
// upcoming, tracks, decodeVenue and decodePerson flatten them back into the
// Event, Venue and Person shapes the views read.
type ProfileMixin = {
  address?: string | null;
  phone?: string | null;
  social_links?: { nodes?: (SocialLink | null)[] | null } | null;
  facebook?: { facebook_id?: string | null; facebook_url?: string | null } | null;
};
type WireVenue = Omit<Venue, 'address' | 'phone' | 'facebook_id' | 'facebook_url'> & { profile?: ProfileMixin | null };
type WirePerson<P extends PersonReference> = Omit<P, 'facebook_id' | 'facebook_url' | 'social_links'> & { profile?: ProfileMixin | null };
type EventVenueMixin = { name?: string | null; venue?: WireVenue | null };
type EventPeopleMixin = { lineup?: { nodes?: (WirePerson<PersonReference> | null)[] | null } | null };
type WireEvent = Omit<Event, 'venue' | 'venue_name' | 'people'> & {
  venue?: EventVenueMixin | null;
  people?: EventPeopleMixin | null;
};
type EventsMixin = { upcoming?: { nodes?: WireEvent[] | null } | null };
type MusicMixin = { tracks?: { nodes?: (Track | null)[] | null } | null };

function decodeVenue({ profile, ...venue }: WireVenue): Venue {
  return { ...venue, address: profile?.address ?? null, phone: profile?.phone ?? null,
    facebook_url: profile?.facebook?.facebook_url ?? null, facebook_id: profile?.facebook?.facebook_id ?? null };
}

// A person's links come only when the document asks for them (their own page).
function decodePerson<P extends PersonReference>({ profile, ...person }: WirePerson<P>): P {
  const links = profile?.social_links?.nodes;
  return {
    ...person,
    facebook_url: profile?.facebook?.facebook_url ?? null, facebook_id: profile?.facebook?.facebook_id ?? null,
    ...(links ? { social_links: links.filter((link): link is SocialLink => link != null) } : {}),
  } as P;
}

// Lists name an event's first act as its host ("with Aurora").
function withHost(event: Event): Event {
  return event.person || !event.people?.length ? event : { ...event, person: event.people[0] };
}

function decodeEvent({ venue: mixin, people, ...event }: WireEvent): Event {
  const lineup = people?.lineup?.nodes;
  return {
    ...event,
    venue: mixin?.venue ? decodeVenue(mixin.venue) : null,
    venue_name: mixin?.name ?? null,
    ...(lineup ? { people: lineup.filter((person) => person != null).map((person) => decodePerson(person)) } : {}),
  };
}

function upcoming(mixin: EventsMixin | null | undefined): Event[] {
  return (mixin?.upcoming?.nodes ?? []).map(decodeEvent).map(withHost);
}

function tracks(mixin: MusicMixin | null | undefined): Track[] {
  return (mixin?.tracks?.nodes ?? []).filter((track): track is Track => track != null);
}

const FRIEND = 'id name facebook_id: facebookId';

// How many of the locale's upcoming events Now lists away from a venue.
const LOCALE_EVENT_LIMIT = 5;

// reportLocation says where you are; friends and events come from the venue's
// or the locale's mixins, whose lists are connections read as nodes.
const NOW = `mutation ReportLocation($position: CoordinatesInput!) {
  reportLocation(input: { position: $position }) {
    venue { ${VENUE} events { upcoming { nodes { ${EVENT} } } } friends { list { nodes { ${FRIEND} } } } }
    nearby_venues: nearbyVenues { ${VENUE} }
    locale {
      id name hero_url: heroUrl
      events { upcoming(first: ${LOCALE_EVENT_LIMIT}) { nodes { ${EVENT} } } }
      friends { list { nodes { ${FRIEND} } } venues { nodes { venue { id } friend_count: friendCount } } }
    }
  }
}`;

const VENUE_PAGE = `query Venue($id: ID!) {
  venues { venue(id: $id) { ${VENUE} events { upcoming { nodes { ${EVENT} } } } } }
}`;

const EVENT_PAGE = `query Event($id: ID!) {
  events { event(id: $id) { ${EVENT} } }
}`;

const PERSON_PAGE = `query Person($id: ID!) {
  people {
    person(id: $id) {
      ${PERSON} banner_url: bannerUrl
      events { upcoming { nodes { ${EVENT} } } }
      profile { social_links: socialLinks { nodes { id handle provider url } } }
      music { tracks { nodes { id title provider provider_url: providerUrl artwork_url: artworkUrl } } }
    }
  }
}`;

type FriendVenue = { venue: { id: string }; friend_count: number };
type FriendsMixin = { list?: { nodes?: Friend[] | null } | null; venues?: { nodes?: FriendVenue[] | null } | null } | null;
type LocationReport = {
  venue?: (WireVenue & { events?: EventsMixin | null; friends?: FriendsMixin }) | null;
  nearby_venues?: WireVenue[] | null;
  locale?: { id: string; name: string; hero_url?: string | null; events?: EventsMixin | null; friends?: FriendsMixin } | null;
};

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
    const data = await graphql<{ reportLocation: LocationReport }>(NOW, { position: { latitude, longitude } });
    const { venue: here, nearby_venues: nearby, locale: place } = data.reportLocation;
    const locale = place ? { id: place.id, name: place.name } : undefined;
    if (here) {
      const { events, friends, ...wire } = here;
      const venue = decodeVenue(wire);
      return { title: venue.name, locale, venue, events: upcoming(events), friends: friends?.list?.nodes ?? [] };
    }
    const friendCount = new Map((place?.friends?.venues?.nodes ?? []).map((f) => [f.venue.id, f.friend_count]));
    return {
      title: place ? 'Happening Now' : undefined,
      image_url: place?.hero_url,
      locale,
      events: upcoming(place?.events).slice(0, LOCALE_EVENT_LIMIT),
      friends: place?.friends?.list?.nodes ?? [],
      venues: nearby?.map(decodeVenue).map((venue) => ({ ...venue, friend_count: friendCount.get(venue.id) ?? 0 })),
    };
  },
  // A venue and its upcoming events, in one request.
  venue: async (id: string): Promise<{ venue: Venue; events: Event[] }> => {
    const { events, ...venue } = found((await graphql<{ venues: { venue: (WireVenue & { events?: EventsMixin | null }) | null } }>(VENUE_PAGE, { id })).venues.venue);
    return { venue: decodeVenue(venue), events: upcoming(events) };
  },
  event: async (id: string): Promise<Event> =>
    decodeEvent(found((await graphql<{ events: { event: WireEvent | null } }>(EVENT_PAGE, { id })).events.event)),
  person: async (id: string): Promise<Person> => {
    type WirePersonPage = WirePerson<Omit<Person, 'events' | 'tracks'>> & { events?: EventsMixin | null; music?: MusicMixin | null };
    const { events, music, ...person } = found((await graphql<{ people: { person: WirePersonPage | null } }>(PERSON_PAGE, { id })).people.person);
    return { ...decodePerson(person), events: upcoming(events), tracks: tracks(music) };
  },
};
