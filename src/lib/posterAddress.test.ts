import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addressLines } from './poster/address.ts';

test('an address prints as the street, then the town, without the country', () => {
  assert.deepEqual(addressLines('1234 Pike St, Seattle, WA 98101, USA'), ['1234 Pike St', 'Seattle, WA 98101']);
  assert.deepEqual(addressLines('1234 Pike St, Seattle, WA 98101, United States'), ['1234 Pike St', 'Seattle, WA 98101']);
  assert.deepEqual(addressLines('Calle de Pelayo 12, 28004 Madrid'), ['Calle de Pelayo 12', '28004 Madrid']);
});

test('a place with no comma stays one line', () => {
  assert.deepEqual(addressLines('Seattle'), ['Seattle']);
  assert.deepEqual(addressLines('  '), []);
});
