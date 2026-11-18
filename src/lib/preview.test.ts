import assert from 'node:assert/strict';
import { test } from 'node:test';
import { previewDescription, previewImage, when } from './preview.ts';
import type { PublicListing } from './publicListing.ts';

const venue: PublicListing = { kind: 'venue', id: 'v', path: '/venues/v', title: 'Disco Pony', description: '',
  visibility: 'public', address: '1901 N 15th St, Tampa, FL', image: 'https://api.audiencekit.com/v1/photos/p' };

test('a venue with no description previews with its address', () => {
  assert.equal(previewDescription(venue), 'Disco Pony · 1901 N 15th St, Tampa, FL');
  assert.equal(previewDescription({ ...venue, address: undefined }), 'Disco Pony on Hot Mess');
  assert.equal(previewDescription({ ...venue, description: 'Cocktails.' }), 'Cocktails.');
});

test('an event previews with when and where', () => {
  const event: PublicListing = { kind: 'event', id: 'e', path: '/events/e', title: 'Drag Bingo', description: ' ',
    start_at: '2026-10-16T21:00:00-07:00', venue_name: 'Purr' };
  assert.equal(previewDescription(event), 'Fri, Oct 16 · 9 PM at Purr');
  assert.equal(previewDescription({ ...event, is_canceled: true }), 'Canceled · Fri, Oct 16 · 9 PM at Purr');
});

test('the day comes from the local time, not the server zone', () => {
  assert.equal(when('2026-10-16T23:30:00-07:00'), 'Fri, Oct 16 · 11:30 PM');
  assert.equal(when('2026-10-17T00:00:00-07:00'), 'Sat, Oct 17 · 12 AM');
  assert.equal(when(undefined), '');
});

test('only Public listings preview with their photo', () => {
  assert.equal(previewImage(venue), venue.image);
  assert.equal(previewImage({ ...venue, visibility: 'community' }), undefined);
  assert.equal(previewImage(undefined), undefined);
});

test('a share card previews with its own line, else an address or when and where', async () => {
  const { cardDescription } = await import('./preview.ts');
  const base = { title: 'The Balcony Club', siteName: 'Hot Mess' };
  assert.equal(cardDescription({ ...base, kind: 'venue', description: 'On Hot Mess', address: '150 N 8th St, Boise' }),
    'The Balcony Club · 150 N 8th St, Boise');
  assert.equal(cardDescription({ ...base, kind: 'venue', description: 'Rooftop bar.' }), 'Rooftop bar.');
  assert.equal(cardDescription({ ...base, kind: 'event', description: '', startAt: '2026-10-16T21:00:00-07:00',
    venueName: 'Purr' }), 'Fri, Oct 16 · 9 PM at Purr');
  assert.equal(cardDescription({ ...base, kind: 'person', title: '406 Pride',
    description: 'Featured on Hot Mess in Billings.' }), 'Featured on Hot Mess in Billings.');
  assert.equal(cardDescription({ ...base, kind: 'venue', description: '' }), 'The Balcony Club on Hot Mess');
});
