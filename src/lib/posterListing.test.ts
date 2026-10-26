import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventListing, listingFromQuery, posterLines, venueListing } from './poster/listing.ts';

const VENUE = { id: '11111111-1111-4111-8111-111111111111', name: 'Neighbours', locale: { name: 'Seattle' }, profile: { address: '1509 Broadway, Seattle' } };

test('a venue poster names the venue and its address, else its city', () => {
  assert.deepEqual(venueListing(VENUE), { kind: 'venue', id: VENUE.id, name: 'Neighbours', place: '1509 Broadway, Seattle', when: '' });
  assert.equal(venueListing({ ...VENUE, profile: { address: null } }).place, 'Seattle');
});

test('an event poster names the night, where and when', () => {
  const event = {
    id: '22222222-2222-4222-8222-222222222222', name: 'Mess Hall Fridays',
    startAt: '2026-10-10T05:00:00Z', endAt: '2026-10-10T09:00:00Z',
    venue: { name: 'Neighbours', venue: { id: VENUE.id, name: 'Neighbours', locale: { name: 'Seattle' } } },
  };
  const listing = eventListing(event, 'en-US', 'America/Los_Angeles');
  assert.equal(listing.place, 'Neighbours · Seattle');
  assert.equal(listing.when, 'Fri, Oct 9 · 10:00 PM – 2:00 AM');
  assert.equal(eventListing({ ...event, venue: null }).place, '');
});

test('the QR code opens the share link, and the address names the listing by kind and UUID', () => {
  assert.deepEqual(posterLines(venueListing(VENUE), 'https://hotmess.social/venues/x?e=v3.abc'),
    { night: 'Neighbours', venue: '1509 Broadway, Seattle', when: '', link: 'https://hotmess.social/venues/x?e=v3.abc' });
  assert.deepEqual(posterLines(null, null), { night: '', venue: '', when: '', link: '' });
  assert.deepEqual(listingFromQuery(new URLSearchParams(`venue=${VENUE.id}`)), { kind: 'venue', id: VENUE.id });
  assert.equal(listingFromQuery(new URLSearchParams('venue=Neighbours')), null);
});
