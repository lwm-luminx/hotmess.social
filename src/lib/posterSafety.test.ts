import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromGuestJSON, type GuestAlertJSON } from './posterSafety.ts';

const json: GuestAlertJSON = {
  id: 'a1', state: 'acknowledged', place: 'dance_floor', concerns: ['bothering', 'following'], description: 'Red cap',
  summary: 'Dance floor · Someone’s bothering them', seen: true, acknowledged_by_name: 'Dee',
  acknowledged_at: '2026-11-15T06:00:00Z', escalated_at: null, closed_at: null, support_shared_at: null,
  support_note: null, created_at: '2026-11-15T05:59:00Z', venue: { id: 'v1', name: 'Purr' },
  messages: [{ id: 'm1', body: 'By the bar', from_staff: false, sender_name: 'Guest (no app)', created_at: '2026-11-15T06:00:05Z' }],
};

test('a guest alert reads as the app’s SafetyAlert', () => {
  const alert = fromGuestJSON(json);
  assert.equal(alert.state, 'ACKNOWLEDGED');
  assert.equal(alert.place, 'DANCE_FLOOR');
  assert.deepEqual(alert.concerns, ['BOTHERING', 'FOLLOWING']);
  assert.equal(alert.acknowledgedByName, 'Dee');
  assert.deepEqual(alert.messages[0], { id: 'm1', body: 'By the bar', fromStaff: false, senderName: 'Guest (no app)', createdAt: '2026-11-15T06:00:05Z' });
});

test('no place stays null', () => {
  assert.equal(fromGuestJSON({ ...json, place: null }).place, null);
});
