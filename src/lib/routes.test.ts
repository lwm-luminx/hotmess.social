import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeFor, pathFor, linkExpiry, linkCheck } from './routes.ts';

const id = '5b3c8a72-4e19-4d06-b2f5-8c7a1e0d9b22';

test('share links route to their detail', () => {
  assert.deepEqual(routeFor(`/venues/${id}`), { kind: 'venue', id });
  assert.deepEqual(routeFor(`/events/${id.toUpperCase()}/`), { kind: 'event', id });
  assert.deepEqual(routeFor(`/people/${id}`), { kind: 'person', id });
  assert.deepEqual(routeFor(`/posts/${id}`), { kind: 'post', id });
});

test('the app root routes to Now', () => {
  assert.deepEqual(routeFor('/app/'), { kind: 'now' });
  assert.deepEqual(routeFor('/app'), { kind: 'now' });
});

test('unknown or malformed paths do not route', () => {
  assert.equal(routeFor('/venues'), null);
  assert.equal(routeFor('/venues/not-a-uuid'), null);
  assert.equal(routeFor(`/places/${id}`), null);
});

test('paths round-trip', () => {
  for (const kind of ['venue', 'event', 'person', 'post', 'safety-alert'] as const) {
    assert.deepEqual(routeFor(pathFor({ kind, id })), { kind, id });
  }
});

const signature = 'Ab3_-xYz0123456Q';
const token = (date: Date) => `${Math.floor(date.getTime() / 1000).toString(36)}.${signature}`;

test('an expiry token decodes to its date', () => {
  assert.deepEqual(linkExpiry(`${(1792000000).toString(36)}.${signature}`), new Date(1792000000 * 1000));
  assert.equal(linkExpiry('not-a-token'), null);
  assert.equal(linkExpiry(`${(1792000000).toString(36)}.short`), null);
});

test('unsigned links open as before', () => {
  assert.equal(linkCheck(''), 'open');
  assert.equal(linkCheck('?utm_source=imessage'), 'open');
});

test('a link past its expiry is expired without asking the API', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');
  assert.equal(linkCheck(`?e=${token(new Date(now - 1000))}`, now), 'expired');
  assert.equal(linkCheck(`?e=${encodeURIComponent(token(new Date(now - 1000)))}&x=1`, now), 'expired');
});

test('a link still in date, or one whose token can\'t be read, asks the API', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');
  assert.equal(linkCheck(`?e=${token(new Date(now + 60_000))}`, now), 'ask');
  assert.equal(linkCheck('?e=garbage', now), 'ask');
  assert.equal(linkCheck('?e=', now), 'ask');
});
