import type { APIRoute } from 'astro';
export const prerender = true;
// The site's own pages, built with the site so the sitemap index always has something to list.
const PAGES = ['/', '/discover', '/download', '/safety', '/poster'];
export const GET: APIRoute = ({ site }) => {
  const origin = site?.origin ?? 'https://hotmess.social';
  const body = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${PAGES.map(path => `<url><loc>${origin}${path}</loc></url>`).join('')}</urlset>`;
  return new Response(body, { headers: { 'content-type': 'application/xml' } });
};
