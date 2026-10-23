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

test('full editorial details require explicit public mode; user and chat data are always discarded', () => {
  const details = { kind: 'event', id, title: 'Music', description: '', start_at: '2026-10-23T20:00:00Z',
    address: '123 Main', image: 'https://example.com/flyer.jpg', chat: 'private', attendees: ['private'] };
  const community = publicListing({ ...details, visibility: 'community' });
  assert.equal(community.start_at, undefined);
  assert.equal(community.address, undefined);
  assert.equal(community.image, undefined);
  const published = publicListing({ ...details, visibility: 'public' });
  assert.equal(published.start_at, details.start_at);
  assert.equal(published.address, details.address);
  assert.equal(published.image, details.image);
  assert.equal('chat' in published, false);
  assert.equal('attendees' in published, false);
});

test('a Public post keeps its text, poster, photos and event, with paths rebuilt from IDs', () => {
  const poster = '22345678-1234-1234-1234-123456789abc';
  const event = '32345678-1234-1234-1234-123456789abc';
  const post = publicListing({ kind: 'post', id, path: '/elsewhere', visibility: 'public', title: 'The Wildrose',
    description: 'Two-for-one wells', body: 'Two-for-one wells until 10.', created_at: '2026-10-23T18:00:00Z', edited: true,
    poster: { kind: 'venue', id: poster, name: 'The Wildrose', path: 'javascript:alert(1)' },
    image: 'https://cdn.example.com/w.jpg', acting_person_name: 'Kiki Riot for House of Lux',
    photos: [{ url: 'https://cdn.example.com/1.jpg', alt_text: 'The bar' }, { url: 'javascript:alert(1)' }, null],
    event: { id: event, name: 'Drag Bingo', path: '/nope', start_at: '2026-10-24T04:00:00Z' },
    comments: ['private'], author_id: 'private' });
  assert.equal(post.path, `/posts/${id}`);
  assert.equal(post.body, 'Two-for-one wells until 10.');
  assert.deepEqual(post.poster, { kind: 'venue', id: poster, name: 'The Wildrose', path: `/venues/${poster}` });
  assert.deepEqual(post.photos, [{ url: 'https://cdn.example.com/1.jpg', alt_text: 'The bar' }]);
  assert.deepEqual(post.event, { id: event, name: 'Drag Bingo', path: `/events/${event}`, start_at: '2026-10-24T04:00:00Z' });
  assert.equal(post.image, 'https://cdn.example.com/w.jpg');
  assert.equal('comments' in post, false);
  assert.equal('author_id' in post, false);
});
test('a Community post is only a sign-in shell, whatever else comes with it', () => {
  const post = publicListing({ kind: 'post', id, visibility: 'community', title: 'Post', description: 'Sign in to see more details.',
    body: 'Members only', photos: [{ url: 'https://cdn.example.com/1.jpg' }], image: 'https://cdn.example.com/w.jpg' });
  assert.deepEqual(Object.keys(post).sort(), ['description', 'id', 'kind', 'path', 'title', 'visibility']);
});
test('post pages share the public page cache', () => {
  assert.equal(pageCacheKey(new Request(`https://hotmess.social/posts/${id}?utm_source=x`))?.url, `https://hotmess.social/posts/${id}`);
});
