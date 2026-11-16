import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clockTime, eventListing, listingFromQuery, nightsOf, posterLines, seriesListing, venueListing } from './poster/listing.ts';

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
    eventSeries: null,
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

const AT = { name: 'Neighbours', venue: { id: VENUE.id, name: 'Neighbours', locale: { name: 'Seattle' } } };
const SERIES = { id: '33333333-3333-4333-8333-333333333333', name: 'Bear Night', recurrenceText: 'Every week on Thursday', startTime: '21:00', timeZone: 'America/Los_Angeles' };

test('a series poster names its schedule, never one date', () => {
  assert.deepEqual(seriesListing(SERIES, AT), { kind: 'series', id: SERIES.id, name: 'Bear Night', place: 'Neighbours · Seattle', when: 'Every week on Thursday · 9 PM' });
  assert.equal(clockTime('21:30'), '9:30 PM');
  assert.equal(clockTime('00:00'), '12 AM');
  assert.equal(clockTime('12:00'), '12 PM');
  assert.equal(clockTime(''), '');
});

test("a venue's nights offer each series once and its one-offs, soonest first", () => {
  const date = (id: string, startAt: string, eventSeries: typeof SERIES | null, name = 'Bear Night') => ({ id, name, startAt, endAt: null, venue: AT, eventSeries });
  const { series, oneOffs } = nightsOf([
    date('c', '2026-10-23T04:00:00Z', SERIES), date('a', '2026-10-16T04:00:00Z', SERIES),
    date('o2', '2026-11-01T04:00:00Z', null, 'Halloween'), date('o1', '2026-10-20T04:00:00Z', null, 'Drag Bingo'),
  ], 'en-US', 'America/Los_Angeles');
  assert.deepEqual(series.map((s) => [s.kind, s.id]), [['series', SERIES.id]]);
  assert.deepEqual(oneOffs.map((o) => o.name), ['Drag Bingo', 'Halloween']);
  assert.deepEqual(listingFromQuery(new URLSearchParams(`series=${SERIES.id}`)), { kind: 'series', id: SERIES.id });
});
