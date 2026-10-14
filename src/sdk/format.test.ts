import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateBadge, distance, eventPhoto, eventTime, facebookURL, initials, providerName, venueHero, venuePhoto } from './format.ts';

test('venue photos fall back between the Page picture and the place', () => {
  assert.equal(venuePhoto({ id: 'v', name: 'Milk+', photo_url: null, hero_url: 'hero' }), 'hero');
  assert.equal(venuePhoto({ id: 'v', name: 'Milk+', photo_url: 'page', hero_url: 'hero' }), 'page');
  assert.equal(venueHero({ id: 'v', name: 'Milk+', photo_url: 'page', hero_url: 'hero' }), 'hero');
  assert.equal(venuePhoto(undefined), undefined);
});

test('events without a banner show their venue', () => {
  const venue = { id: 'v', name: 'Milk+', hero_url: 'hero' };
  assert.equal(eventPhoto({ id: 'e', name: 'Bear Night', start_at: '2026-10-09T02:00:00Z', venue }), 'hero');
  assert.equal(eventPhoto({ id: 'e', name: 'Bear Night', start_at: '2026-10-09T02:00:00Z', banner_url: 'banner', venue }), 'banner');
});

test('event photo fallback priority in person and venue views', () => {
  const venue = { id: 'v', name: 'Milk+', hero_url: 'venue-hero' };
  const person = { id: 'p', name: 'DJ Aurora', photo_url: 'person-photo' };
  const fallbackPerson = { id: 'fp', name: 'Host', photo_url: 'fallback-person-photo' };
  const fallbackVenue = { id: 'fv', name: 'Club', hero_url: 'fallback-venue-hero' };

  // On a person page: event -> venue -> person
  // 1. With event banner:
  assert.equal(eventPhoto({ id: 'e', name: 'Gig', start_at: '2026-10-09T02:00:00Z', banner_url: 'banner', venue, person }, 'venue-first', undefined, fallbackPerson), 'banner');
  // 2. Without event banner, with venue:
  assert.equal(eventPhoto({ id: 'e', name: 'Gig', start_at: '2026-10-09T02:00:00Z', venue, person }, 'venue-first', undefined, fallbackPerson), 'venue-hero');
  // 3. Without event banner and without event venue, with fallback venue:
  assert.equal(eventPhoto({ id: 'e', name: 'Gig', start_at: '2026-10-09T02:00:00Z', person }, 'venue-first', fallbackVenue, fallbackPerson), 'fallback-venue-hero');
  // 4. Without event banner and without venue, falls back to person:
  assert.equal(eventPhoto({ id: 'e', name: 'Gig', start_at: '2026-10-09T02:00:00Z', person }, 'venue-first', undefined, fallbackPerson), 'person-photo');
  assert.equal(eventPhoto({ id: 'e', name: 'Gig', start_at: '2026-10-09T02:00:00Z' }, 'venue-first', undefined, fallbackPerson), 'fallback-person-photo');

  // In a venue view: event -> person -> venue
  // 1. With event banner:
  assert.equal(eventPhoto({ id: 'e', name: 'Gig', start_at: '2026-10-09T02:00:00Z', banner_url: 'banner', venue, person }, 'person-first', fallbackVenue), 'banner');
  // 2. Without event banner, with person:
  assert.equal(eventPhoto({ id: 'e', name: 'Gig', start_at: '2026-10-09T02:00:00Z', venue, person }, 'person-first', fallbackVenue), 'person-photo');
  // 3. Without event banner and without event person, falls back to venue:
  assert.equal(eventPhoto({ id: 'e', name: 'Gig', start_at: '2026-10-09T02:00:00Z', venue }, 'person-first', fallbackVenue), 'venue-hero');
  assert.equal(eventPhoto({ id: 'e', name: 'Gig', start_at: '2026-10-09T02:00:00Z' }, 'person-first', fallbackVenue), 'fallback-venue-hero');
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
  assert.equal(providerName('podcast_rss'), 'RSS');
  assert.equal(providerName('bandcamp'), 'Bandcamp');
});
