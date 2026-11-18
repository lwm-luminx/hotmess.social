// Local SSR fixture only. Never used by a deployment or public-content code.
import { createServer } from 'node:http';
const venue = { kind: 'venue', id: '11111111-1111-4111-8111-111111111111', title: 'Neighbours',
  description: 'A public business listing.', address: '1509 Broadway, Seattle' };
const event = { kind: 'event', id: '22222222-2222-4222-8222-222222222222', title: 'Mess Hall',
  description: 'Music and performances.' };
const records = [venue, event].map(item => ({ ...item, path: `/${item.kind === 'venue' ? 'venues' : 'events'}/${item.id}` }));
const cards = {
  '/people/33333333-3333-4333-8333-333333333333': { kind: 'person', id: '33333333-3333-4333-8333-333333333333',
    site_name: 'Hot Mess', title: 'Kiki Riot', description: 'Featured on Hot Mess in Seattle.',
    image: { url: 'https://api.audiencekit.com/v1/photos/kiki', alt: 'Kiki Riot' } },
  '/people/44444444-4444-4444-8444-444444444444': { kind: 'person', id: '44444444-4444-4444-8444-444444444444',
    site_name: 'Hot Mess', title: 'A performer on Hot Mess', description: "Sign in to Hot Mess to see who's performing.",
    image: null, visibility: 'community' },
};
createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname === '/v1/token/service') return res.end(JSON.stringify({ token: 'fixture-service-jwt', expiresAt: '2099-01-01T00:00:00Z' }));
  if (url.pathname === '/v1/share') {
    // People have no public listing: their page previews from the share card alone (ShareCard#person).
    const card = cards[url.searchParams.get('path')];
    const token = url.searchParams.get('e');
    if (token === null) { res.statusCode = card ? 200 : 404; return res.end(JSON.stringify(card ?? {})); }
    const expiry = parseInt(token.split('.')[0], 36) * 1000;
    res.statusCode = expiry > Date.now() ? 200 : 410;
    return res.end(JSON.stringify(res.statusCode === 200 ? card ?? {} : {}));
  }
  // Discover's session check (src/server/publicContent.ts signedIn): the e2e session (e2e/app/fixtures.ts TOKEN) is signed in.
  if (url.pathname === '/v1/branding') return res.end(JSON.stringify({ audience: { id: 'a0000000-0000-4000-8000-000000000000' } }));
  if (url.pathname === '/v1/audience/a0000000-0000-4000-8000-000000000000/graphql') {
    if (req.headers.authorization !== 'Bearer e2e.session.jwt') { res.statusCode = 401; return res.end('{}'); }
    return res.end(JSON.stringify({ data: { me: { self: { id: 'e2e-viewer' } } } }));
  }
  if (req.headers.authorization !== 'Bearer fixture-service-jwt') { res.statusCode = 401; return res.end('{}'); }
  // The venue's board for its web sign (/venues/<id>/display), which the Velvet cast receiver falls back to.
  if (url.pathname === `/v1/public/venues/${venue.id}/tonight`) return res.end(JSON.stringify({
    venue: { id: venue.id, title: venue.title, time_zone: 'America/Los_Angeles' }, night: '2026-11-15',
    events: [{ id: event.id, name: event.title }],
    lineup: [{ id: 'a1', kind: 'act', role: 'dj', title: null, people: [{ name: 'DJ Fallback' }], more: 0,
      starts_at: null, start_timing: 'none', state: 'on' }],
    slogans: null,
  }));
  if (url.pathname === '/v1/public/listings') return res.end(JSON.stringify({ listings: records, next_page: null, page_count: 1 }));
  const record = records.find(item => `/v1/public${item.path}` === url.pathname);
  res.statusCode = record ? 200 : 404;
  res.end(JSON.stringify(record ?? {}));
}).listen(4399, '127.0.0.1');
