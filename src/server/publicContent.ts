import { env } from 'cloudflare:workers';
import { publicListing, type PublicListing } from '../lib/publicListing';

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
export async function signedLinkStatus(path: string, signature: string): Promise<number> {
  const query = new URLSearchParams({ path, e: signature,
    host: settings().PUBLIC_CONTENT_HOST ?? 'hotmess.admin.next.audiencekit.com' });
  const response = await fetch(`${apiBase()}/v1/share?${query}`, { signal: AbortSignal.timeout(8000) });
  return response.status;
}
