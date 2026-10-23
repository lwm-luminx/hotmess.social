import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber, isUnanswered, lineNumbers, type SafetyAlert } from './safety.ts';

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
