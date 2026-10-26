import type { APIRoute } from 'astro';
import { listings, siteOrigin } from '../server/publicContent';
export const prerender = false;
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export const GET: APIRoute = async ({ url }) => {
  const page = Number(url.searchParams.get('page') ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return new Response('Not found', { status: 404 });
  const origin = siteOrigin();
  const index = (count: number) => `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${xml(origin)}/sitemap-pages.xml</loc></sitemap>${Array.from({ length: count }, (_, i) => `<sitemap><loc>${xml(origin)}/sitemap.xml?page=${i + 1}</loc></sitemap>`).join('')}</sitemapindex>`;
  try {
    const result = await listings(page);
    // A sitemap index lists all bounded pages, never a nested index.
    const body = url.searchParams.has('page')
      ? `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${result.listings.map(item => `<url><loc>${xml(origin + item.path)}</loc></url>`).join('')}</urlset>`
      : index(result.page_count);
    return new Response(body, { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=300, s-maxage=3600' } });
  } catch (error) {
    console.error('sitemap: public listings unavailable', error);
    // Crawlers give up on a sitemap that fails to fetch, so the index still answers with the site's own pages
    // (kept out of the edge cache so listings return as soon as the API does).
    if (!url.searchParams.has('page')) return new Response(index(0), { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=60' } });
    return new Response('Temporarily unavailable', { status: 503, headers: { 'cache-control': 'no-store', 'retry-after': '300' } });
  }
};
