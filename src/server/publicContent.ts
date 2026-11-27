import { env } from 'cloudflare:workers';
import { AudienceKitClient, AudienceKitError, FetchTransport, Website } from 'audience-kit';
import { publicListing, type PublicListing } from '../lib/publicListing';
import { venueTonight, type VenueTonight } from '../lib/venueDisplay';
import { shareCard, type ShareCard } from '../lib/shareCard';
import { resourceDirectory, resourceLocales, type ResourceDirectory, type ResourceLocale } from '../lib/communityResources';

interface Settings { PUBLIC_CONTENT_API_BASE?: string; PUBLIC_CONTENT_HOST?: string;
  PUBLIC_SITE_ORIGIN?: string; AUDIENCEKIT_SERVICE_TOKEN?: string }
const settings = () => env as unknown as Settings;
export const siteOrigin = () => settings().PUBLIC_SITE_ORIGIN ?? 'https://hotmess.social';
const apiBase = () => settings().PUBLIC_CONTENT_API_BASE ?? 'https://api.audiencekit.com';
const host = () => settings().PUBLIC_CONTENT_HOST ?? 'hotmess.admin.audiencekit.com';
const TIMEOUT = 8000;

interface OriginSettings { AUDIENCEKIT_ORIGIN_SECRET?: string }

// Only plain values live across requests. A Worker isolate serves many requests, and a promise, Response or client
// started in one request can't be finished from another: Cloudflare fails it at once ("Cannot perform I/O on behalf
// of a different request"), and every later request in that isolate failed with it in 2 ms (the /thanksgiving 503s of
// 2026-11-27). So each request makes its own AudienceKit client, and they share the audience's id and the service
// session's token, which are strings.
let shared: { key: string; audienceId?: string; token?: string; until?: number } = { key: '' };
const SESSION_LIFETIME = 50 * 60 * 1000; // The service session lasts an hour; trade again before it runs out.

function sharedFor(key: string) {
  if (shared.key !== key) shared = { key };
  return shared;
}

/** Keeps the service session's token in `shared`, for the next request's client. */
class SharedTokenStore {
  constructor(private readonly state: ReturnType<typeof sharedFor>) {}
  loadToken() { return this.state.token && (this.state.until ?? 0) > Date.now() ? this.state.token : null; }
  saveToken(token: string) { this.state.token = token; this.state.until = Date.now() + SESSION_LIFETIME; }
  deleteToken() { this.state.token = undefined; this.state.until = undefined; }
}

/**
 * Sends the Worker's origin secret (AUDIENCEKIT_ORIGIN_SECRET) as `X-AudienceKit-Origin` on every API call, so the API
 * counts the site's calls against the site's own rate-limit budget instead of the one address every Worker shares.
 */
function originFetch(): (url: string, init: RequestInit) => Promise<Response> {
  const secret = (env as unknown as OriginSettings).AUDIENCEKIT_ORIGIN_SECRET;
  return (url, init) => {
    if (!secret) return fetch(url, init);
    const headers = new Headers(init.headers);
    headers.set('X-AudienceKit-Origin', secret);
    return fetch(url, { ...init, headers });
  };
}

/** This request's AudienceKit client (the audience-kit SDK), on the shared audience id and service session. */
function sdk(): { client: AudienceKitClient; website: Website.WebsiteClient } {
  const secret = settings().AUDIENCEKIT_SERVICE_TOKEN ?? '';
  const state = sharedFor([apiBase(), host(), secret].join('|'));
  const client = new AudienceKitClient({
    configuration: { baseUrl: apiBase(), host: host(), ...(state.audienceId ? { audienceId: state.audienceId } : {}) },
    transport: new FetchTransport({ timeoutMillis: TIMEOUT, fetch: originFetch() }),
    tokenStore: new SharedTokenStore(state),
  });
  return { client, website: new Website.WebsiteClient(client) };
}

/** The audience the site serves, looked up once per isolate from the configured host. */
async function rememberAudience(client: AudienceKitClient): Promise<void> {
  const state = sharedFor([apiBase(), host(), settings().AUDIENCEKIT_SERVICE_TOKEN ?? ''].join('|'));
  if (!state.audienceId) state.audienceId = await client.audienceId();
}

/** The SDK client with the service session, or an error when the Worker has no service token. */
async function credentialed(): Promise<{ client: AudienceKitClient; website: Website.WebsiteClient }> {
  const secret = settings().AUDIENCEKIT_SERVICE_TOKEN;
  if (!secret) throw new Error('Public site credential is not configured');
  const current = sdk();
  if (!(await current.client.isSignedIn())) {
    try {
      await current.client.useServiceToken(secret);
    } catch {
      throw new Error('Public site authentication failed');
    }
  }
  return current;
}

const unavailable = (what = 'Public content') => (error: unknown): never => {
  if (error instanceof AudienceKitError) throw new Error(`${what} is unavailable`, { cause: error });
  throw error;
};

export async function listing(path: string): Promise<PublicListing | null> {
  const [kind, id] = path.replace(/^\//, '').split('/');
  const kinds = { venues: 'venue', events: 'event', posts: 'post' } as const;
  const one = kinds[kind as keyof typeof kinds];
  if (!one || !id) return null;
  const { client } = await credentialed();
  const found = await client.publicListing(one, id).catch(unavailable());
  return found && publicListing(found);
}
export async function listings(page: number): Promise<{ listings: PublicListing[]; next_page: number | null; page_count: number }> {
  const { client } = await credentialed();
  const body = await client.publicListingsPage(page).catch(unavailable());
  return { listings: body.listings.map(publicListing), next_page: body.nextPage, page_count: body.pageCount };
}
/**
 * Whether a Hot Mess session token (the web app's, from the request's Authorization header) is signed in to this
 * site's audience: the API answers `me` for it. Throws when the API can't say.
 */
export async function signedIn(authorization: string | null): Promise<boolean> {
  if (!authorization || !/^Bearer [\w.-]+$/.test(authorization)) return false;
  // A client of its own: the visitor's token, never the site's service session.
  const client = new AudienceKitClient({
    configuration: { baseUrl: apiBase(), host: host() },
    transport: new FetchTransport({ timeoutMillis: TIMEOUT, fetch: originFetch() }),
  });
  await client.useBearerToken(authorization.slice('Bearer '.length));
  try {
    return (await new Website.WebsiteClient(client).viewerId()) !== null;
  } catch (error) {
    if (error instanceof AudienceKitError && (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN')) return false;
    throw new Error('The API could not check the session', { cause: error });
  }
}
/**
 * The API's answer for a share link (GET /v1/share): its status (200, 404 nothing to share, 410 expired or forged)
 * and, on 200, the card a link preview shows. `signature` is the link's `e`, or null for an unsigned link.
 */
export async function shareLink(path: string, signature: string | null): Promise<{ status: number; card: ShareCard | null }> {
  const answer = await sdk().website.shareLink(path, signature);
  return { status: answer.status, card: answer.status === 200 ? shareCard(answer.card) : null };
}
/** Tonight at a venue for its display (/venues/<id>/display), or null when it has none. */
export async function tonight(id: string): Promise<VenueTonight | null> {
  const { client } = await credentialed();
  try {
    return venueTonight(await client.publicTonight<Record<string, unknown>>(id));
  } catch (error) {
    if (error instanceof AudienceKitError && error.code === 'NOT_FOUND') return null;
    return unavailable()(error);
  }
}
/**
 * The venue a short code names, from the cover poster's public read (`GET /v1/cover/:code`, the same code), which needs
 * no site credential: what /v/<code> falls back on when the credentialed read fails. Null for no such venue.
 */
export async function venueForCode(code: string): Promise<string | null> {
  if (!/^[0-9a-zA-Z]{8}$/.test(code)) return null;
  const answer = await sdk().website.coverPoster<{ venue?: { id?: unknown } }>(code, new URL(siteOrigin()).host).catch(unavailable());
  const id = typeof answer?.venue?.id === 'string' ? answer.venue.id.toLowerCase() : '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) ? id : null;
}
/** Where a venue's short link (/v/<code>) goes, its chat (`/venues/<id>/chat`), or null for no such venue. */
export async function shortLink(code: string): Promise<string | null> {
  if (!/^[0-9a-zA-Z]{8}$/.test(code)) return null;
  const { website } = await credentialed();
  const path = await website.publicShortLink(code).catch(unavailable());
  return path && /^\/venues\/[0-9a-f-]{36}\/chat$/.test(path) ? path : null;
}
/**
 * The cities with community resources (food, shelter, clinics, crisis and DV lines), live from the API's public
 * directory: no site credential, the same answer for everyone (audience_kit_api CommunityResourcesController).
 */
export async function resourceCities(): Promise<ResourceLocale[]> {
  const { client, website } = sdk();
  await rememberAudience(client).catch(unavailable('Community resources'));
  return resourceLocales(await website.communityResourceLocales<unknown>().catch(unavailable('Community resources')));
}
/** A city's community resource directory, live from the API, or null for no such city. */
export async function resourceDirectoryFor(localeId: string): Promise<ResourceDirectory | null> {
  const { client, website } = sdk();
  await rememberAudience(client).catch(unavailable('Community resources'));
  const body = await website.communityResources<unknown>(localeId).catch(unavailable('Community resources'));
  return body === null ? null : resourceDirectory(body);
}
