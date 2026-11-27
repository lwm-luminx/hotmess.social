// The Hot Mess (AudienceKit) API, through the AudienceKit SDK (audience-kit, audience-kit-sdk node/): sign-in, and the
// website's pages, posters and privacy choices from its Website client, whose GraphQL documents the SDK validates
// against the API's schema. This file only adapts it to the site: the session lives in this browser's storage
// (src/lib/session.ts), and failures become the site's APIError (src/lib/apiErrors.ts), which the screens branch on.
import { AudienceKitClient, AudienceKitError, Website, type DeviceDescription } from 'audience-kit';
import type { Event, Now, Person, TokenResponse, Venue } from '../sdk/types';
import { API_BASE, AUDIENCE_HOST, FACEBOOK_APP_ID } from './config';
import { APIError, graphqlError, type GraphQLError } from './apiErrors';
import type { AppleSignIn } from './apple';
import { session, sessionStore } from './session';
import { venueShortLink } from './venueShortLink';

export { APIError } from './apiErrors';
export { session, SESSION_EVENT } from './session';
export type { Event, Now, Person, Venue } from '../sdk/types';
export type { Post, PosterEvent, PosterSeries, PosterVenue, SignInMethods } from '../sdk/types';

export const client = new AudienceKitClient({
  configuration: { baseUrl: API_BASE, host: AUDIENCE_HOST, facebookAppId: FACEBOOK_APP_ID },
  tokenStore: sessionStore,
});
export const website = new Website.WebsiteClient(client);

const DEVICE_KEY = 'hotmess.device';

// The API keys sessions by device, so a browser gets a stable identifier.
function deviceIdentifier(): string {
  let s: Storage | null = null;
  try { s = window.localStorage; } catch { /* private mode */ }
  let id = s?.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    s?.setItem(DEVICE_KEY, id);
  }
  return id;
}

function device(): DeviceDescription {
  return { type: 'web', identifier: deviceIdentifier(), version: '1.0', build: '1', model: navigator.userAgent.slice(0, 120) };
}

/** The site's APIError for an SDK failure; anything else (a network failure) as it was. */
export function apiError(operation: string, error: unknown): unknown {
  if (!(error instanceof AudienceKitError)) return error;
  switch (error.code) {
    case 'GRAPHQL':
      return graphqlError(operation, error.errors as GraphQLError[]);
    case 'UNAUTHORIZED':
    case 'NOT_SIGNED_IN':
      return new APIError(401, error.message, 'UNAUTHENTICATED');
    case 'SIGN_IN_REJECTED':
      return new APIError(401, error.message);
    case 'SIGN_IN_FAILED':
      return new APIError(400, error.message, 'INVALID');
    case 'FORBIDDEN':
      return new APIError(error.status ?? 403, error.message, error.apiCode ?? 'FORBIDDEN', error.fields, error.reason);
    case 'NOT_FOUND':
      return new APIError(error.status ?? 404, error.message, error.apiCode ?? 'NOT_FOUND', error.fields, error.reason);
    case 'HTTP':
      return new APIError(error.status ?? 500, error.message, error.apiCode, error.fields, error.reason);
    case 'NETWORK':
      return error;
    default:
      return new APIError(500, error.message);
  }
}

/** Runs an SDK call, failing with the site's APIError; a session the API refused is forgotten. */
export async function call<T>(operation: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    const error = apiError(operation, e);
    if (error instanceof APIError && error.signedOut && session.token) session.end();
    throw error;
  }
}

export const api = {
  // Answers the token JSON (doc/TOKENS.md), which the SDK has already kept in the session. A token Facebook refuses is
  // 400 INVALID with Facebook's reason as the message; 401 means the app or audience refused it.
  signIn: (facebookToken: string): Promise<TokenResponse> => call('SignIn', () => client.signIn(facebookToken, device())),
  // Signs in with Apple's identity token. A token Apple didn't vouch for, or whose nonce doesn't match, is 401.
  signInWithApple: (apple: AppleSignIn): Promise<TokenResponse> =>
    call('SignInWithApple', () => client.signInWithApple(apple, device())),
  // Signs in with a Google access token, which the API checks was issued to one of its client IDs.
  signInWithGoogle: (accessToken: string): Promise<TokenResponse> =>
    call('SignInWithGoogle', () => client.signInWithGoogleAccessToken(accessToken, device())),
  // The ways the audience lets people sign in, with the warning to show before each one that has one, or null when the
  // API can't say: the sign-in card then shows Facebook with no warning.
  signInMethods: () => website.signInMethods().catch(() => null),
  // Whether a signed share link (?e=) has expired or been tampered with, which the API answers with 410. Anything
  // else, a network failure included, opens the link as before.
  shareLinkExpired: async (path: string, e: string): Promise<boolean> => {
    try {
      return (await website.shareLink(path, e, location.hostname)).status === 410;
    } catch {
      return false;
    }
  },
  // Records where you are, which is how the API knows the venue you're at.
  now: (latitude: number, longitude: number): Promise<Now> => call('ReportLocation', () => website.now(latitude, longitude)),
  whereAmI: (latitude: number, longitude: number) => call('WhereAmI', () => website.whereAmI(latitude, longitude)),
  // A venue and its upcoming events, in one request.
  venue: (id: string): Promise<{ venue: Venue; events: Event[] }> => call('Venue', () => website.venue(id)),
  event: (id: string): Promise<Event> => call('Event', () => website.event(id)),
  person: (id: string): Promise<Person> => call('Person', () => website.person(id)),
  post: (id: string) => call('Post', () => website.post(id)),
  // Venues (visible ones) matching a search by name. A night is picked from its venue's (posterNights).
  posterSearch: (search: string) => call('PosterSearch', () => website.posterSearch(search)),
  // A venue's upcoming events, each with the series it belongs to, for the night picker (src/lib/poster/listing.ts
  // nightsOf folds a series' dates into one choice).
  posterNights: (venueId: string) => call('PosterNights', () => website.posterNights(venueId)),
  // A series for a poster, its coming dates, and the link its QR code opens: its venue's short link (/v/<code>,
  // src/lib/venueShortLink.ts), which outlives any one date.
  posterSeries: async (id: string) => {
    const { series, events } = await call('PosterSeries', () => website.posterSeries(id));
    const venueId = events.find((e) => e.venue?.venue)?.venue?.venue?.id;
    return { series, events, link: venueId ? venueShortLink(venueId) : null };
  },
  // A venue for a poster, and its short link.
  posterVenue: async (id: string) => {
    const venue = await call('PosterVenue', () => website.posterVenue(id));
    return { venue, link: venueShortLink(venue.id) };
  },
  // What a venue charges at the door, for its cover poster: null when it has no cover set up here.
  posterCover: (id: string) => call('PosterCover', () => website.posterCover(id)),
  // The venue's safety poster link, made the first time; only its managers get one (FORBIDDEN for anyone else).
  printSafetyPoster: (venueId: string) => call('PrintSafetyPoster', () => website.printSafetyPoster(venueId)),
  // A one-off event for a poster, and its share link, which opens for a year (a printed poster's lifetime); null when
  // the API won't sign one. Its ?e=v3.<hash> is a signature the API checks, never an expiry to read here.
  posterEvent: (id: string) => call('PosterEvent', () => website.posterEvent(id)),
};
