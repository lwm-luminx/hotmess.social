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
const apiBase = () => settings().PUBLIC_CONTENT_API_BASE ?? 'https://api.next.audiencekit.com';
const host = () => settings().PUBLIC_CONTENT_HOST ?? 'hotmess.admin.next.audiencekit.com';
const TIMEOUT = 8000;

// The site's own AudienceKit client (the audience-kit SDK): it trades the Worker's service token (`public:read`) for an
// hour-long session and trades again before it runs out. Made again when a setting changes.
let site: { key: string; client: AudienceKitClient; website: Website.WebsiteClient } | undefined;
function sdk(): { client: AudienceKitClient; website: Website.WebsiteClient } {
  const secret = settings().AUDIENCEKIT_SERVICE_TOKEN ?? '';
  const key = [apiBase(), host(), secret].join('|');
  if (site?.key !== key) {
    const client = new AudienceKitClient({
      configuration: { baseUrl: apiBase(), host: host() },
      transport: new FetchTransport({ timeoutMillis: TIMEOUT }),
    });
    site = { key, client, website: new Website.WebsiteClient(client) };
  }
  return site;
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
    transport: new FetchTransport({ timeoutMillis: TIMEOUT }),
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
  return resourceLocales(await sdk().website.communityResourceLocales<unknown>().catch(unavailable('Community resources')));
}
/** A city's community resource directory, live from the API, or null for no such city. */
export async function resourceDirectoryFor(localeId: string): Promise<ResourceDirectory | null> {
  const body = await sdk().website.communityResources<unknown>(localeId).catch(unavailable('Community resources'));
  return body === null ? null : resourceDirectory(body);
}
