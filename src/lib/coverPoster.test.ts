import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { money, nightLabel, offer, pageLanguage, passCode, timeLabel, type CoverJSON, type NightJSON } from './coverPoster.ts';

const cover: CoverJSON = {
  night: '2026-11-20', event_id: null, amount_cents: 1000, fee_cents: 50, total_cents: 1112, currency: 'usd',
  cover_from: '21:00', cover_until: null, tiers: [], payable: true, provider: 'stripe', guest_checkout: true, max_quantity: 10,
};
const night = (over: Partial<NightJSON>): NightJSON => ({ night: '2026-11-20', tonight: true, event: null, cover: null, ...over });

test('a night offers what the venue can take', () => {
  assert.equal(offer(night({ cover })).kind, 'buy');
  assert.equal(offer(night({ cover: { ...cover, guest_checkout: false, provider: 'square' } })).kind, 'app');
  assert.equal(offer(night({ cover: { ...cover, payable: false, guest_checkout: false } })).kind, 'door');
  assert.deepEqual(offer(night({ event: { id: 'e', name: 'Bingo', start_at: null, public: true, ticket_url: 'https://t' } })), { kind: 'tickets', url: 'https://t' });
  assert.equal(offer(night({ event: { id: null, name: null, start_at: null, public: false } })).kind, 'free');
  assert.equal(offer(night({})).kind, 'nothing');
  assert.equal(offer(null).kind, 'nothing');
});

test('words and numbers in English and Spanish', () => {
  assert.equal(pageLanguage(['es-MX', 'en']), 'es');
  assert.equal(pageLanguage(['en-US', 'es']), 'en');
  assert.equal(pageLanguage(undefined), 'en');
  assert.equal(money(1000), '$10');
  assert.equal(money(1112), '$11.12');
  assert.equal(nightLabel('2026-11-20'), 'Friday, Nov 20');
  assert.match(nightLabel('2026-11-20', 'es'), /viernes/);
  assert.equal(timeLabel('21:00'), '9 PM');
  assert.equal(timeLabel('00:30'), '12:30 AM');
  assert.equal(timeLabel('21:00', 'es'), '21:00 h');
});

test('the pass code matches the API’s CoverPass', async () => {
  const secret = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');
  const now = 1_763_000_000_000;
  const window = Math.floor(now / 1000 / 30);
  const expected = createHmac('sha256', Buffer.from(secret, 'base64')).update(`adm1.${window}`).digest('base64url').slice(0, 16);
  assert.equal(await passCode('adm1', secret, now), `HMC1.adm1.${window}.${expected}`);
});
