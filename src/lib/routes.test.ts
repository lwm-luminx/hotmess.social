import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeFor, pathFor } from './routes.ts';

const id = '5b3c8a72-4e19-4d06-b2f5-8c7a1e0d9b22';

test('share links route to their detail', () => {
  assert.deepEqual(routeFor(`/venues/${id}`), { kind: 'venue', id });
  assert.deepEqual(routeFor(`/events/${id.toUpperCase()}/`), { kind: 'event', id });
  assert.deepEqual(routeFor(`/people/${id}`), { kind: 'person', id });
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
  for (const kind of ['venue', 'event', 'person'] as const) {
    assert.deepEqual(routeFor(pathFor({ kind, id })), { kind, id });
  }
});
