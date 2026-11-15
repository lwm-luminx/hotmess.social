import type { APIRoute } from 'astro';
import { recordVisit } from '../server/visits';
export const prerender = false;
// Counts a page being opened (server/visits.ts): which page, never who. Pages call it once as they load
// (layouts/Base.astro). It reads no cookie and no address, sets nothing and always answers 204.
export const POST: APIRoute = async ({ request, url }) => {
  try {
    const text = await request.text();
    if (text.length <= 2000) recordVisit(JSON.parse(text), request.headers.get('user-agent'), url.host);
  } catch {
    // Not counted.
  }
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
};
