import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endsLabel, invitationQuery, parseInvitation, pingId } from './invitation.ts';

const PING = '55555555-5555-4555-8555-555555555555';
const VENUE = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';

test('pingId reads /pings/<uuid> and nothing else', () => {
  assert.equal(pingId(`/pings/${PING}`), PING);
  assert.equal(pingId(`/pings/${PING.toUpperCase()}/`), PING);
  assert.equal(pingId('/pings/not-a-uuid'), null);
  assert.equal(pingId(`/venues/${VENUE}`), null);
  assert.equal(pingId(`/pings/${PING}/extra`), null);
});

test('invitationQuery passes the token through untouched', () => {
  assert.deepEqual(Object.fromEntries(invitationQuery('hotmess.social', PING, 'v3.abc')),
    { host: 'hotmess.social', path: `/pings/${PING}`, e: 'v3.abc' });
});

test('parseInvitation reads the API JSON', () => {
  const invitation = parseInvitation({
    kind: 'ping', id: PING, title: 'Jordan wants to go out', note: ' Drinks first? ', sender_name: 'Jordan',
    expires_at: '2026-10-24T12:00:00Z',
    targets: [
      { id: VENUE, name: 'Neighbours', path: `/venues/${VENUE}` },
      { id: EVENT, name: 'Drag Bingo', path: `/events/${EVENT.toUpperCase()}` },
      { id: 'x', name: 'Elsewhere', path: 'https://evil.example/venues/1' },
      { id: 'y', name: '' },
    ],
  });
  assert.ok(invitation);
  assert.equal(invitation.title, 'Jordan wants to go out');
  assert.equal(invitation.note, 'Drinks first?');
  assert.equal(invitation.senderName, 'Jordan');
  assert.equal(invitation.expiresAt.toISOString(), '2026-10-24T12:00:00.000Z');
  assert.deepEqual(invitation.targets, [
    { id: VENUE, name: 'Neighbours', path: `/venues/${VENUE}` },
    { id: EVENT, name: 'Drag Bingo', path: `/events/${EVENT}` },
    { id: 'x', name: 'Elsewhere', path: null },
  ]);
});

test('parseInvitation refuses anything that is not a ping invitation', () => {
  assert.equal(parseInvitation(null), null);
  assert.equal(parseInvitation({ error: 'EXPIRED' }), null);
  assert.equal(parseInvitation({ kind: 'venue', id: VENUE, title: 'x', expires_at: '2026-10-24T12:00:00Z' }), null);
  assert.equal(parseInvitation({ kind: 'ping', id: PING, title: 'x', expires_at: 'soon' }), null);
  const bare = parseInvitation({ kind: 'ping', id: PING, title: 'x', expires_at: '2026-10-24T12:00:00Z' });
  assert.deepEqual(bare?.targets, []);
  assert.equal(bare?.note, null);
});

test('endsLabel shows the local time, with the weekday when more than a day away', () => {
  const now = new Date('2026-10-24T03:00:00Z'); // Fri 8pm in Seattle
  // ICU versions differ on the space before AM.
  const label = (iso: string) => endsLabel(new Date(iso), now, 'en-US', 'America/Los_Angeles').replace(/\s/g, ' ');
  assert.equal(label('2026-10-24T12:00:00Z'), 'Ends 5:00 AM');
  assert.equal(label('2026-10-25T12:00:00Z'), 'Ends Sun 5:00 AM');
});
