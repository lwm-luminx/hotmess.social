// Cloudflare Worker in front of hotmess.social (GitHub Pages). GitHub Pages serves every share link from 404.html with
// a 404 status and the site's generic tags, so link previews show nothing about the venue, event or person. For a
// share link this asks the API for the record's public card (GET /v1/share) and answers 200 with its title, photo and
// description in the <head>; the page itself still runs the web app. Everything else passes straight through.
import { pathFor, routeFor } from '../../src/lib/routes';
import { downloadUrl } from '../../src/lib/download';
import { headTags, rewriteHead, type ShareCard } from './shareCard';

interface Env {
  API_BASE: string;
  APP_STORE_ID: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Apple's CDN wants JSON; GitHub Pages serves the extensionless file as application/octet-stream.
    if (url.pathname === '/.well-known/apple-app-site-association') {
      return withHeaders(await fetch(request), { 'content-type': 'application/json' });
    }

    // Phones go straight to their store; everyone else gets the page with both links.
    if (url.pathname === '/download' || url.pathname === '/download/') {
      const store = downloadUrl(request.headers.get('user-agent') ?? '');
      if (store) return Response.redirect(store, 302);
      return fetch(request);
    }

    const route = routeFor(url.pathname);
    const isShareLink = route !== null && route.kind !== 'now' && !url.pathname.startsWith('/app');
    if (!isShareLink || (request.method !== 'GET' && request.method !== 'HEAD')) return fetch(request);

    const path = pathFor(route);
    const [page, card] = await Promise.all([fetch(request), shareCard(env, url.hostname, path)]);
    if (card === 'missing') return page; // GitHub Pages' 404 stands: there's nothing at this link.

    const html = await page.text();
    const body = card ? rewriteHead(html, headTags(card, env.APP_STORE_ID)) : html;
    return new Response(request.method === 'HEAD' ? null : body, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Short, so a renamed venue or new photo shows up in fresh previews soon.
        'cache-control': 'public, max-age=300',
      },
    });
  },
};

/** The record's card, 'missing' when the API says there's no such record, or null when the API couldn't answer. */
async function shareCard(env: Env, host: string, path: string): Promise<ShareCard | 'missing' | null> {
  const query = new URLSearchParams({ host, path });
  try {
    const response = await fetch(`${env.API_BASE}/v1/share?${query}`, {
      headers: { accept: 'application/json' },
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit);
    if (response.status === 404) return 'missing';
    if (!response.ok) return null;
    return (await response.json()) as ShareCard;
  } catch {
    return null;
  }
}

function withHeaders(response: Response, headers: Record<string, string>): Response {
  const copy = new Response(response.body, response);
  for (const [name, value] of Object.entries(headers)) copy.headers.set(name, value);
  return copy;
}
