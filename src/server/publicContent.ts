import { env } from 'cloudflare:workers';
import { publicListing, type PublicListing } from '../lib/publicListing';
import { venueTonight, type VenueTonight } from '../lib/venueDisplay';
import { shareCard, type ShareCard } from '../lib/shareCard';
import { resourceDirectory, resourceLocales, type ResourceDirectory, type ResourceLocale } from '../lib/communityResources';

interface Settings { PUBLIC_CONTENT_API_BASE?: string; PUBLIC_CONTENT_HOST?: string;
  PUBLIC_SITE_ORIGIN?: string; AUDIENCEKIT_SERVICE_TOKEN?: string }
const settings = () => env as unknown as Settings;
export const siteOrigin = () => settings().PUBLIC_SITE_ORIGIN ?? 'https://hotmess.social';
const apiBase = () => settings().PUBLIC_CONTENT_API_BASE ?? 'https://api.next.audiencekit.com';
let credential: { secret: string; token: string; until: number } | undefined;
let exchanging: Promise<string> | undefined;
async function token(): Promise<string> {
  const secret = settings().AUDIENCEKIT_SERVICE_TOKEN;
  if (!secret) throw new Error('Public site credential is not configured');
  if (credential?.secret === secret && credential.until > Date.now()) return credential.token;
  if (exchanging) return exchanging;
  exchanging = (async () => {
    const response = await fetch(`${apiBase()}/v1/token/service`, { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ service_token: secret }),
      signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Public site authentication failed');
    const body = await response.json() as { token: string; expiresAt: string };
    credential = { secret, token: body.token, until: Date.parse(body.expiresAt) - 60000 };
    return body.token;
  })();
  try { return await exchanging; } finally { exchanging = undefined; }
}
async function request(path: string): Promise<Response> {
  const response = await fetch(`${apiBase()}/v1/public/${path}`, {
    headers: { authorization: `Bearer ${await token()}`, accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 401) credential = undefined;
  return response;
}
export async function listing(path: string): Promise<PublicListing | null> {
  const response = await request(path.replace(/^\//, ''));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Public content is unavailable');
  return publicListing(await response.json());
}
export async function listings(page: number): Promise<{ listings: PublicListing[]; next_page: number | null; page_count: number }> {
  const response = await request(`listings?page=${page}`);
  if (!response.ok) throw new Error('Public content is unavailable');
  const body = await response.json() as { listings: unknown[]; next_page: number | null; page_count: number };
  return { listings: body.listings.map(publicListing), next_page: body.next_page, page_count: body.page_count };
}
let hotMessAudience: Promise<string> | undefined;
// The audience the site serves (PUBLIC_CONTENT_HOST's), whose sign-ins it accepts.
function audience(): Promise<string> {
  const query = new URLSearchParams({ host: settings().PUBLIC_CONTENT_HOST ?? 'hotmess.admin.next.audiencekit.com' });
  hotMessAudience ??= fetch(`${apiBase()}/v1/branding?${query}`, { signal: AbortSignal.timeout(8000) })
    .then(async (response) => {
      if (!response.ok) throw new Error('Branding is unavailable');
      return ((await response.json()) as { audience: { id: string } }).audience.id;
    })
    .catch((e) => { hotMessAudience = undefined; throw e; });
  return hotMessAudience;
}
const VIEWER = 'query DiscoverViewer { me { self { id } } }';
/**
 * Whether a Hot Mess session token (the web app's, from the request's Authorization header) is signed in to this
 * site's audience: the API answers `me` for it. Throws when the API can't say.
 */
export async function signedIn(authorization: string | null): Promise<boolean> {
  if (!authorization || !/^Bearer [\w.-]+$/.test(authorization)) return false;
  const response = await fetch(`${apiBase()}/v1/audience/${await audience()}/graphql`, {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { authorization, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ query: VIEWER, operationName: 'DiscoverViewer' }),
  });
  if (response.status === 401 || response.status === 403) return false;
  if (!response.ok) throw new Error('The API could not check the session');
  const body = await response.json() as { data?: { me?: { self?: { id?: string } } | null } };
  return !!body.data?.me?.self?.id;
}
/**
 * The API's answer for a share link (GET /v1/share): its status (200, 404 nothing to share, 410 expired or forged)
 * and, on 200, the card a link preview shows. `signature` is the link's `e`, or null for an unsigned link.
 */
export async function shareLink(path: string, signature: string | null): Promise<{ status: number; card: ShareCard | null }> {
  const query = new URLSearchParams({ path, host: settings().PUBLIC_CONTENT_HOST ?? 'hotmess.admin.next.audiencekit.com' });
  if (signature !== null) query.set('e', signature);
  const response = await fetch(`${apiBase()}/v1/share?${query}`, { signal: AbortSignal.timeout(8000) });
  if (response.status !== 200) return { status: response.status, card: null };
  return { status: 200, card: shareCard(await response.json()) };
}
/** Tonight at a venue for its display (/venues/<id>/display), or null when it has none. */
export async function tonight(id: string): Promise<VenueTonight | null> {
  const response = await request(`venues/${id}/tonight`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Public content is unavailable');
  return venueTonight(await response.json() as Record<string, unknown>);
}
/** Where a venue's short link (/v/<code>) goes, its chat (`/venues/<id>/chat`), or null for no such venue. */
export async function shortLink(code: string): Promise<string | null> {
  if (!/^[0-9a-zA-Z]{8}$/.test(code)) return null;
  const response = await request(`v/${code}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Public content is unavailable');
  const { path } = await response.json() as { path?: unknown };
  return typeof path === 'string' && /^\/venues\/[0-9a-f-]{36}\/chat$/.test(path) ? path : null;
}
/**
 * The cities with community resources (food, shelter, clinics, crisis and DV lines), live from the API's public
 * directory: no site credential, the same answer for everyone (audience_kit_api CommunityResourcesController).
 */
export async function resourceCities(): Promise<ResourceLocale[]> {
  const response = await fetch(`${apiBase()}/v1/audience/${await audience()}/community_resources/locales`,
    { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Community resources are unavailable');
  return resourceLocales(await response.json());
}
/** A city's community resource directory, live from the API, or null for no such city. */
export async function resourceDirectoryFor(localeId: string): Promise<ResourceDirectory | null> {
  const query = new URLSearchParams({ locale_id: localeId });
  const response = await fetch(`${apiBase()}/v1/audience/${await audience()}/community_resources?${query}`,
    { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Community resources are unavailable');
  return resourceDirectory(await response.json());
}
