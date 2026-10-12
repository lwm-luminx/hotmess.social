import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateBadge, distance, eventHost, eventPhoto, eventPlace, eventTime, facebookURL, initials, nodes, providerName, venueHero, venuePhoto } from './format.ts';
import type { Event } from './types.ts';

const venue = { id: 'v', name: 'Milk+', photoUrl: null, bannerUrl: 'banner' };
const event: Event = {
  id: 'e', name: 'Bear Night', startAt: '2026-10-09T02:00:00Z', endAt: null, facebookId: null, bannerUrl: null,
  venue: { name: 'Milk+', venue },
};

test('connections read as their non-null nodes', () => {
  assert.deepEqual(nodes({ nodes: [{ id: 'a' }, null, { id: 'b' }] }), [{ id: 'a' }, { id: 'b' }]);
  assert.deepEqual(nodes({ nodes: null }), []);
  assert.deepEqual(nodes(undefined), []);
});

test('venue photos fall back between the place and its banner', () => {
  assert.equal(venuePhoto(venue), 'banner');
  assert.equal(venuePhoto({ ...venue, photoUrl: 'place' }), 'place');
  assert.equal(venueHero({ ...venue, photoUrl: 'place' }), 'banner');
  assert.equal(venueHero({ ...venue, bannerUrl: null, photoUrl: 'place' }), 'place');
  assert.equal(venuePhoto(undefined), undefined);
});

test('events without a banner show their venue', () => {
  assert.equal(eventPhoto(event), 'banner');
  assert.equal(eventPhoto({ ...event, bannerUrl: 'cover' }), 'cover');
  assert.equal(eventPhoto({ ...event, venue: { name: 'To be announced', venue: null } }), undefined);
});

test('an event is placed by its venue, else by what its venue mixin names', () => {
  assert.equal(eventPlace(event), 'Milk+');
  assert.equal(eventPlace({ ...event, venue: { name: 'Secret warehouse', venue: null } }), 'Secret warehouse');
});

test('the first act on the bill hosts the event', () => {
  assert.equal(eventHost(event), undefined);
  const hosted = { ...event, people: { lineup: { nodes: [null, { id: 'p', name: 'Aurora' }] } } };
  assert.equal(eventHost(hosted)?.name, 'Aurora');
});

test('Facebook links skip IDs the API leaves empty', () => {
  assert.equal(facebookURL(''), undefined);
  assert.equal(facebookURL(null), undefined);
  assert.equal(facebookURL('0'), undefined);
  assert.equal(facebookURL('100046536945318'), 'https://www.facebook.com/100046536945318');
  assert.equal(facebookURL('123', 'event'), 'https://www.facebook.com/events/123/');
});

test('an evening shows one date with its start and end times', () => {
  const text = eventTime({ startAt: '2026-10-10T02:00:00Z', endAt: '2026-10-10T05:00:00Z' }, 'en-US', 'America/Denver');
  assert.equal(text, 'Fri, Oct 9 · 8:00 PM – 11:00 PM');
});

test('a night that runs past midnight still reads as one night', () => {
  const text = eventTime({ startAt: '2026-10-10T04:00:00Z', endAt: '2026-10-10T08:00:00Z' }, 'en-US', 'America/Denver');
  assert.equal(text, 'Fri, Oct 9 · 10:00 PM – 2:00 AM');
});

test('an event with no start yet has no time or badge', () => {
  assert.equal(eventTime({ startAt: null, endAt: null }), '');
  assert.deepEqual(dateBadge(null), { month: '', day: '' });
});

test('date badges, distances, initials and providers', () => {
  assert.deepEqual(dateBadge('2026-10-10T02:00:00Z', 'en-US', 'America/Denver'), { month: 'OCT', day: '9' });
  assert.equal(distance(100), '330 ft');
  assert.equal(distance(1609.344 * 2.43), '2.4 mi');
  assert.equal(distance(null), undefined);
  assert.equal(initials('Rick Mark'), 'RM');
  assert.equal(initials(null), '');
  assert.equal(providerName('soundcloud'), 'SoundCloud');
  assert.equal(providerName('apple_music'), 'Apple Music');
  assert.equal(providerName('mixcloud'), 'Mixcloud');
});
