import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventPosters, nextPoster, posterKicker, MAX_POSTERS } from './poster/eventPosters.ts';

test('posters from a cast message keep only what is safe to draw', () => {
  const posters = eventPosters([
    { id: 'e1', name: 'Show Tunes', when: 'Tonight · 9 PM', billing: 'with Anya', cover: 'Free',
      image: 'https://cdn.example/s.jpg', link: 'https://hotmess.social/events/e1' },
    { id: 'e2', name: 'Karaoke', when: 'Tomorrow · 9 PM', image: 'http://cdn.example/k.jpg', link: 'https://evil.example/' },
    { id: '', name: 'No id' },
    { id: 'e3' },
    'junk',
  ]);
  assert.equal(posters.length, 2);
  assert.deepEqual(posters[0], { id: 'e1', name: 'Show Tunes', when: 'Tonight · 9 PM', billing: 'with Anya', cover: 'Free',
    image: 'https://cdn.example/s.jpg', link: 'https://hotmess.social/events/e1' });
  assert.equal(posters[1].image, null);
  assert.equal(posters[1].cover, null);
  assert.equal(posters[1].link, 'https://hotmess.social/events/e2');
  assert.deepEqual(eventPosters(undefined), []);
});

test('at most six posters', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ id: `e${i}`, name: `Night ${i}` }));
  assert.equal(eventPosters(many).length, MAX_POSTERS);
});

test('posters take turns soonest first and come round again', () => {
  const posters = eventPosters([{ id: 'a', name: 'A', when: 'Tonight · 9 PM' }, { id: 'b', name: 'B', when: 'Fri, Dec 5 · 9 PM' }]);
  assert.equal(nextPoster(posters, null)?.id, 'a');
  assert.equal(nextPoster(posters, 'a')?.id, 'b');
  assert.equal(nextPoster(posters, 'b')?.id, 'a');
  assert.equal(nextPoster(posters, 'gone')?.id, 'a');
  assert.equal(nextPoster([], null), null);
  assert.equal(posterKicker(posters[0]), 'Tonight');
  assert.equal(posterKicker(posters[1]), 'Coming up');
});

test('the web sign words its posters as Velvet does', async () => {
  const { postersFromTonight } = await import('./poster/eventPosters.ts');
  const posters = postersFromTonight([
    { id: 'a', name: 'Show Tunes', startAt: '2026-10-10T04:00:00Z', night: '2026-10-09', image: 'https://cdn.example/a.jpg',
      people: ['Anya', 'Darcy'], coverCents: 0 },
    { id: 'b', name: 'Karaoke', startAt: '2026-10-11T04:30:00Z', night: '2026-10-10', image: null, people: [], coverCents: 1050 },
    { id: 'c', name: 'Drag Brunch', startAt: '2026-10-17T19:00:00Z', night: '2026-10-17', image: null, people: [], coverCents: null },
    { id: 'd', name: 'Benefit', startAt: '2026-10-18T04:00:00Z', night: '2026-10-17', image: null, people: [],
      coverCents: 1500, coverMinCents: 500, coverMaxCents: 3000 },
  ], '2026-10-09', 'America/Los_Angeles');
  assert.deepEqual(posters.map((p) => p.when), ['Tonight · 9 PM', 'Tomorrow · 9:30 PM', 'Sat, Oct 17 · 12 PM', 'Sat, Oct 17 · 9 PM']);
  assert.deepEqual(posters.map((p) => p.cover), ['Free', '$10.50 cover', null, '$5–$30 cover, pay what you can']);
  assert.equal(posters[0].billing, 'with Anya · Darcy');
  assert.equal(posters[2].link, 'https://hotmess.social/events/c');
});
