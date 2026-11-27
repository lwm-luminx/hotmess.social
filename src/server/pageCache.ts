// Cache only explicit anonymous page routes. Cookies/Authorization never affect their renderer.
export function pageCacheKey(request: Request): Request | null {
  if (!['GET', 'HEAD'].includes(request.method)) return null;
  const url = new URL(request.url);
  if (url.searchParams.has('e')) return null; // Always validate signed-link expiry before rendering.
  if (!/^\/(venues|events|posts|people)\/[0-9a-f-]{36}$/.test(url.pathname) &&
      !/^\/(resources|thanksgiving|christmas)(\/[\w-]+)?$/.test(url.pathname) && url.pathname !== '/sitemap.xml') return null;
  const page = url.searchParams.get('page');
  url.search = '';
  if (page && url.pathname === '/sitemap.xml') url.searchParams.set('page', page);
  return new Request(url.toString());
}
export function edgeResponse(response: Response): Response | null {
  const control = response.headers.get('cache-control') ?? '';
  const ttl = control.match(/s-maxage=(\d+)/)?.[1];
  if (response.status !== 200 || !ttl || response.headers.has('set-cookie') || /private|no-store/.test(control)) return null;
  const copy = new Response(response.clone().body, response);
  copy.headers.set('cache-control', `public, max-age=${ttl}`);
  copy.headers.set('x-public-cache-control', control);
  return copy;
}
// The last good copy of a page, kept a week, for when the API can't answer: a holiday page that worked an hour ago
// beats "we couldn't load the cities" (2026-11-27). Its own cache key, so the fresh copy's short life doesn't end it.
export const STALE_TTL = 7 * 24 * 60 * 60;
export function staleKey(key: Request): Request {
  const url = new URL(key.url);
  url.searchParams.set('__last_good', '1');
  return new Request(url.toString());
}
export function staleCopy(response: Response): Response | null {
  const fresh = edgeResponse(response);
  if (!fresh) return null;
  fresh.headers.set('cache-control', `public, max-age=${STALE_TTL}`);
  return fresh;
}
/** A kept copy served in place of a failed render: browsers and Cloudflare keep it only briefly. */
export function staleResponse(response: Response, method: string): Response {
  const copy = new Response(method === 'HEAD' ? null : response.body, response);
  copy.headers.set('cache-control', 'public, max-age=60');
  copy.headers.delete('x-public-cache-control');
  copy.headers.set('x-served-from', 'last-good-copy');
  return copy;
}
export function browserResponse(response: Response, method: string): Response {
  const copy = new Response(method === 'HEAD' ? null : response.body, response);
  const control = copy.headers.get('x-public-cache-control');
  if (control) copy.headers.set('cache-control', control);
  copy.headers.delete('x-public-cache-control');
  return copy;
}
