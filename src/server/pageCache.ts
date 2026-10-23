// Cache only explicit anonymous page routes. Cookies/Authorization never affect their renderer.
export function pageCacheKey(request: Request): Request | null {
  if (!['GET', 'HEAD'].includes(request.method)) return null;
  const url = new URL(request.url);
  if (url.searchParams.has('e')) return null; // Always validate signed-link expiry before rendering.
  if (!/^\/(venues|events|posts)\/[0-9a-f-]{36}$/.test(url.pathname) &&
      !['/discover', '/sitemap.xml'].includes(url.pathname)) return null;
  const page = url.searchParams.get('page');
  url.search = '';
  if (page && ['/discover', '/sitemap.xml'].includes(url.pathname)) url.searchParams.set('page', page);
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
export function browserResponse(response: Response, method: string): Response {
  const copy = new Response(method === 'HEAD' ? null : response.body, response);
  const control = copy.headers.get('x-public-cache-control');
  if (control) copy.headers.set('cache-control', control);
  copy.headers.delete('x-public-cache-control');
  return copy;
}
