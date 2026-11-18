import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shareCard } from './shareCard.ts';

test('reads a venue card from the API', () => {
  const card = shareCard({ kind: 'venue', id: 'v', site_name: 'Hot Mess', title: 'The Balcony Club', description: 'On Hot Mess',
    image: { url: 'https://api.audiencekit.com/v1/photos/p?sig=x', alt: 'The Balcony Club' },
    venue: { address: '150 N 8th St, Boise', phone: null } });
  assert.deepEqual(card, { kind: 'venue', title: 'The Balcony Club', description: 'On Hot Mess', siteName: 'Hot Mess',
    image: 'https://api.audiencekit.com/v1/photos/p?sig=x', address: '150 N 8th St, Boise' });
});

test('a Community performer card names no one and has no picture', () => {
  const card = shareCard({ kind: 'person', title: 'A performer on Hot Mess', description: "Sign in to Hot Mess to see who's performing.",
    image: null, visibility: 'community', site_name: 'Hot Mess' });
  assert.equal(card?.title, 'A performer on Hot Mess');
  assert.equal(card?.image, undefined);
  assert.equal(card?.visibility, 'community');
});

test('reads an event card and ignores pictures that are not https', () => {
  const card = shareCard({ kind: 'event', title: 'Drag Bingo', description: '', image: { url: 'http://x/y' },
    event: { start_at: '2026-10-16T21:00:00-07:00', venue_name: 'Purr', is_canceled: true } });
  assert.equal(card?.image, undefined);
  assert.equal(card?.venueName, 'Purr');
  assert.equal(card?.isCanceled, true);
});

test('anything else is not a card', () => {
  assert.equal(shareCard(null), null);
  assert.equal(shareCard({ kind: 'ping', title: 'A Ping' }), null);
  assert.equal(shareCard({ kind: 'venue', title: '' }), null);
});
