import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNightPrice } from './rateCard.ts';

test('formats whole dollars without cents, other amounts with two places, and zero as free', () => {
  assert.equal(formatNightPrice(1500), '$15');
  assert.equal(formatNightPrice(750), '$7.50');
  assert.equal(formatNightPrice(0), 'Free');
});
