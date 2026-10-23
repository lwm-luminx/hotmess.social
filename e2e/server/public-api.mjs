// Local SSR fixture only. Never used by a deployment or public-content code.
import { createServer } from 'node:http';
const venue = { kind: 'venue', id: '11111111-1111-4111-8111-111111111111', title: 'Neighbours',
  description: 'A public business listing.', address: '1509 Broadway, Seattle' };
const event = { kind: 'event', id: '22222222-2222-4222-8222-222222222222', title: 'Mess Hall',
  description: 'Music and performances.' };
const records = [venue, event].map(item => ({ ...item, path: `/${item.kind === 'venue' ? 'venues' : 'events'}/${item.id}` }));
createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname === '/v1/token/service') return res.end(JSON.stringify({ token: 'fixture-service-jwt', expiresAt: '2099-01-01T00:00:00Z' }));
  if (url.pathname === '/v1/share') {
    const expiry = parseInt((url.searchParams.get('e') ?? '').split('.')[0], 36) * 1000;
    res.statusCode = expiry > Date.now() ? 200 : 410;
    return res.end('{}');
  }
  if (req.headers.authorization !== 'Bearer fixture-service-jwt') { res.statusCode = 401; return res.end('{}'); }
  if (url.pathname === '/v1/public/listings') return res.end(JSON.stringify({ listings: records, next_page: null, page_count: 1 }));
  const record = records.find(item => `/v1/public${item.path}` === url.pathname);
  res.statusCode = record ? 200 : 404;
  res.end(JSON.stringify(record ?? {}));
}).listen(4399, '127.0.0.1');
