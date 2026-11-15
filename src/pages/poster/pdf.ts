import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { fontDataUrl, posterPdfHtml, renderPdf } from '../../server/posterPdf';
import { signedIn, siteOrigin } from '../../server/publicContent';
export const prerender = false;
// The cover and safety posters as print-ready PDFs (src/server/posterPdf.ts), for someone signed in to Hot Mess.
// The safety poster's link comes from printSafetyPoster, which only the venue's managers can call.
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status,
  headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' } });
interface Bindings { BROWSER?: unknown; ASSETS?: { fetch(input: string): Promise<Response> } }
export const POST: APIRoute = async ({ request, url }) => {
  const bindings = env as unknown as Bindings;
  if (!bindings.BROWSER || !bindings.ASSETS) return json({ error: 'PDFs are not available here' }, 503);
  try {
    if (!await signedIn(request.headers.get('authorization'))) return json({ error: 'Sign in to Hot Mess' }, 401);
  } catch {
    return json({ error: 'Hot Mess could not check your sign-in' }, 503);
  }
  const font = await bindings.ASSETS.fetch(new URL('/fonts/Figtree-Variable.woff2', url).href);
  if (!font.ok) return json({ error: 'PDFs are not available here' }, 503);
  const poster = posterPdfHtml(await request.json().catch(() => null), siteOrigin(), await fontDataUrl(await font.arrayBuffer()));
  if (!poster) return json({ error: 'That isn’t a poster Hot Mess prints' }, 422);
  try {
    const pdf = await renderPdf(bindings.BROWSER, poster.html);
    return new Response(pdf as Uint8Array<ArrayBuffer>, { headers: {
      'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${poster.file}"`,
      'cache-control': 'private, no-store', 'x-robots-tag': 'noindex',
    } });
  } catch {
    return json({ error: 'Hot Mess could not make the PDF just now' }, 503);
  }
};
