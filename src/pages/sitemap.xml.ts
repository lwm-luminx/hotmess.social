import type { APIRoute } from 'astro';
import { listings, siteOrigin } from '../server/publicContent';
export const prerender = false;
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export const GET: APIRoute = async ({ url }) => {
  const page = Number(url.searchParams.get('page') ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return new Response('Not found', { status: 404 });
  try {
    const result = await listings(page);
    const origin = siteOrigin();
    // A sitemap index lists all bounded pages, never a nested index.
    let body: string;
    if (!url.searchParams.has('page')) {
      const count = result.page_count;
      body = `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({ length: count }, (_, i) => `<sitemap><loc>${xml(origin)}/sitemap.xml?page=${i + 1}</loc></sitemap>`).join('')}</sitemapindex>`;
    } else {
      body = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${result.listings.map(item => `<url><loc>${xml(origin + item.path)}</loc></url>`).join('')}</urlset>`;
    }
    return new Response(body, { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=300, s-maxage=3600' } });
  } catch { return new Response('Temporarily unavailable', { status: 503, headers: { 'cache-control': 'no-store' } }); }
};
