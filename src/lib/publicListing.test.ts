import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicListing } from './publicListing.ts';
import { pageCacheKey, edgeResponse, browserResponse } from '../server/pageCache.ts';
const id = '12345678-1234-1234-1234-123456789abc';
test('event projections discard location, dates, images and unrelated API data', () => {
  const value = publicListing({ kind: 'event', id, title: 'Music', description: 'Live music',
    address: 'Private address', starts_at: 'tomorrow', image: 'flyer.jpg', token: 'secret', venue: 'Secret venue' });
  assert.deepEqual(Object.keys(value).sort(), ['description', 'id', 'kind', 'path', 'title']);
});
test('venue websites cannot inject executable URLs', () => {
  assert.equal(publicListing({ kind: 'venue', id, title: 'Venue', description: '', website: 'javascript:alert(1)' }).website, undefined);
});
test('tracking parameters and visitor credentials share a public cache key; signed links never do', () => {
  const url = `https://hotmess.social/events/${id}`;
  assert.equal(pageCacheKey(new Request(`${url}?utm_source=google`, { headers: { cookie: 'session=private', authorization: 'Bearer private' } }))?.url, url);
  assert.equal(pageCacheKey(new Request(`${url}?e=signed`)), null);
  assert.equal(pageCacheKey(new Request('https://hotmess.social/app/')), null);
  assert.equal(pageCacheKey(new Request(url, { method: 'POST' })), null);
});
test('cache excludes private responses, errors and cookies and preserves browser TTL', () => {
  assert.equal(edgeResponse(new Response('private', { headers: { 'cache-control': 'private, s-maxage=60' } })), null);
  assert.equal(edgeResponse(new Response('error', { status: 503, headers: { 'cache-control': 's-maxage=60' } })), null);
  assert.equal(edgeResponse(new Response('cookie', { headers: { 'set-cookie': 'x=y', 'cache-control': 's-maxage=60' } })), null);
  const cached = edgeResponse(new Response('public', { headers: { 'cache-control': 'public, max-age=300, s-maxage=86400' } }))!;
  assert.equal(cached.headers.get('cache-control'), 'public, max-age=86400');
  assert.equal(browserResponse(cached, 'GET').headers.get('cache-control'), 'public, max-age=300, s-maxage=86400');
});
