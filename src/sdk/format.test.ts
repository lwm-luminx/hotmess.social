import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateBadge, distance, eventPhoto, eventTime, facebookURL, initials, providerName, venueHero, venuePhoto } from './format.ts';

test('venue photos fall back between the Page picture and the place', () => {
  assert.equal(venuePhoto({ id: 'v', name: 'Milk+', photo_url: null, hero_url: 'hero' }), 'hero');
  assert.equal(venuePhoto({ id: 'v', name: 'Milk+', photo_url: 'page', hero_url: 'hero' }), 'page');
  assert.equal(venueHero({ id: 'v', name: 'Milk+', photo_url: 'page', hero_url: 'hero' }), 'hero');
  assert.equal(venuePhoto(undefined), undefined);
});

test('events without a cover show their venue', () => {
  const venue = { id: 'v', name: 'Milk+', hero_url: 'hero' };
  assert.equal(eventPhoto({ id: 'e', name: 'Bear Night', start_at: '2026-10-09T02:00:00Z', venue }), 'hero');
  assert.equal(eventPhoto({ id: 'e', name: 'Bear Night', start_at: '2026-10-09T02:00:00Z', cover_photo_url: 'cover', venue }), 'cover');
});

test('Facebook links skip IDs the API leaves empty', () => {
  assert.equal(facebookURL(''), undefined);
  assert.equal(facebookURL(null), undefined);
  assert.equal(facebookURL(0), undefined);
  assert.equal(facebookURL('100046536945318'), 'https://www.facebook.com/100046536945318');
  assert.equal(facebookURL(123, 'event'), 'https://www.facebook.com/events/123/');
});

test('an evening shows one date with its start and end times', () => {
  const text = eventTime({ start_at: '2026-10-10T02:00:00Z', end_at: '2026-10-10T05:00:00Z' }, 'en-US', 'America/Denver');
  assert.equal(text, 'Fri, Oct 9 · 8:00 PM – 11:00 PM');
});

test('a night that runs past midnight still reads as one night', () => {
  const text = eventTime({ start_at: '2026-10-10T04:00:00Z', end_at: '2026-10-10T08:00:00Z' }, 'en-US', 'America/Denver');
  assert.equal(text, 'Fri, Oct 9 · 10:00 PM – 2:00 AM');
});

test('date badges, distances, initials and providers', () => {
  assert.deepEqual(dateBadge('2026-10-10T02:00:00Z', 'en-US', 'America/Denver'), { month: 'OCT', day: '9' });
  assert.equal(distance(100), '330 ft');
  assert.equal(distance(1609.344 * 2.43), '2.4 mi');
  assert.equal(distance(null), undefined);
  assert.equal(initials('Rick Mark'), 'RM');
  assert.equal(providerName('soundcloud'), 'SoundCloud');
  assert.equal(providerName('bandcamp'), 'Bandcamp');
});
