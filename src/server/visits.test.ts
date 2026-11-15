import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordVisit, visitFor } from './visits.ts';

const id = '5b3c8a72-4e19-4d06-b2f5-8c7a1e0d9b22';
const browser = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile Safari/604.1';
const host = 'hotmess.social';
const visit = (path: unknown, referrer?: unknown, agent: string | null = browser) =>
  visitFor({ path, referrer }, agent, host);

test('a person opening a page counts, by kind of page', () => {
  assert.deepEqual(visit('/'), { page: 'home', path: '/' });
  assert.deepEqual(visit('/money/'), { page: 'money', path: '/money' });
  assert.deepEqual(visit(`/venues/${id}`), { page: 'venue', path: `/venues/${id}` });
});

test('nothing about the person is kept', () => {
  const lines: string[] = [];
  recordVisit({ path: `/events/${id}?e=v3.abc&utm_source=x`, referrer: 'https://www.instagram.com/p/abc/?igsh=1' },
    browser, host, (line) => lines.push(line));
  assert.deepEqual(JSON.parse(lines[0]), {
    visit: { page: 'event', path: `/events/${id}`, from: 'www.instagram.com' },
  });
  assert.doesNotMatch(lines[0], /iPhone|utm|v3\.abc|igsh/);
});

test('the signed-in app, pings and short links never say which one', () => {
  assert.deepEqual(visit(`/app/people/${id}`), { page: 'app', path: '/app' });
  assert.deepEqual(visit(`/pings/${id}`), { page: 'pings', path: '/pings/:id' });
  assert.deepEqual(visit('/v/abc123'), { page: 'v', path: '/v/:code' });
});

test('a link from our own site names no referrer', () => {
  assert.equal(visit('/safety', 'https://hotmess.social/')?.from, undefined);
  assert.equal(visit('/safety', 'not a url')?.from, undefined);
});

test('bots, assets and junk are not visits', () => {
  assert.equal(visit('/', undefined, 'Googlebot/2.1'), null);
  assert.equal(visit('/', undefined, 'facebookexternalhit/1.1'), null);
  assert.equal(visit('/', undefined, null), null);
  assert.equal(visit('/favicon.svg'), null);
  assert.equal(visit('/_astro/app.js'), null);
  assert.equal(visit('https://elsewhere.example/'), null);
  assert.equal(visit(42), null);
  assert.equal(visit('/' + 'a'.repeat(400)), null);
});

test('a bad report is ignored, never thrown', () => {
  const lines: string[] = [];
  recordVisit(null as never, browser, host, (line) => lines.push(line));
  assert.deepEqual(lines, []);
});
