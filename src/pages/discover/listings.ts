import type { APIRoute } from 'astro';
import { listings, signedIn } from '../../server/publicContent';
export const prerender = false;
// Discover's listings (src/app/Discover.tsx), for someone signed in to Hot Mess only. Never cached: the answer depends
// on the caller's session (src/server/pageCache.ts leaves this path alone).
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status,
  headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' } });
export const GET: APIRoute = async ({ request, url }) => {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  if (!Number.isSafeInteger(page) || page > 10000) return json({ error: 'Not found' }, 404);
  try {
    if (!await signedIn(request.headers.get('authorization'))) return json({ error: 'Sign in to Hot Mess' }, 401);
    return json(await listings(page));
  } catch {
    return json({ error: 'Listings are temporarily unavailable' }, 503);
  }
};
