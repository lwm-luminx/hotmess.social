import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber, isUnanswered, lineNumbers, pickupAt, rideLink, type SafetyAlert } from './safety.ts';

const alert = {
  id: 'a', state: 'OPEN', createdAt: '2026-10-23T03:15:00Z', escalatedAt: null,
} as SafetyAlert;

test('offers other ways to get help once nobody picks an alert up in 2 minutes', () => {
  const sent = Date.parse(alert.createdAt);
  assert.equal(isUnanswered(alert, sent + 90_000), false);
  assert.equal(isUnanswered(alert, sent + 121_000), true);
  assert.equal(isUnanswered({ ...alert, state: 'ACKNOWLEDGED' }, sent + 600_000), false);
});

test('writes support numbers out so they can be read aloud', () => {
  assert.equal(formatNumber('8775658860'), '877-565-8860');
  assert.equal(lineNumbers({ id: 't', name: 'Trevor', description: null, phone: '18664887386', textNumber: '678678', textBody: 'START', url: null }),
    'Call 1-866-488-7386 · Text START to 678678');
});

test("sets a ride's pickup at the venue, or opens the app plain without one", () => {
  const ride = {
    id: 'uber', name: 'Uber', url: 'https://m.uber.com/ul/',
    pickupUrl: 'https://m.uber.com/ul/?action=setPickup&pickup%5Blatitude%5D={latitude}&pickup%5Blongitude%5D={longitude}&pickup%5Bnickname%5D={name}',
  };
  const pickup = pickupAt('SRID=4326;POINT (-122.3197 47.6137)', 'The Wildrose & Co');
  assert.deepEqual(pickup, { latitude: 47.6137, longitude: -122.3197, name: 'The Wildrose & Co' });
  assert.equal(rideLink(ride, pickup),
    'https://m.uber.com/ul/?action=setPickup&pickup%5Blatitude%5D=47.613700&pickup%5Blongitude%5D=-122.319700&pickup%5Bnickname%5D=The%20Wildrose%20%26%20Co');
  assert.equal(rideLink(ride, null), 'https://m.uber.com/ul/');
  assert.equal(pickupAt(null, 'x'), null);
});
