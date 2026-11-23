import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detail, isOn, known, LABELS, money, passButton, passOffered, variablesFor, type PrivacyChoices } from './privacyChoices.ts';

const choices: PrivacyChoices = {
  saleShareOptedOut: true, saleShareOptOutSource: 'GLOBAL_PRIVACY_CONTROL', adMeasurement: false,
  countedInAdMeasurement: false, personalizedAds: false, mayShare: false, privacyPassUntil: null,
};

test('turning one switch sends only that choice', () => {
  assert.deepEqual(variablesFor('SALE_SHARE_OPT_OUT', false), { saleShareOptOut: false });
  assert.deepEqual(variablesFor('AD_MEASUREMENT', true), { adMeasurement: true });
});

test('reads each switch', () => {
  assert.equal(isOn(choices, 'SALE_SHARE_OPT_OUT'), true);
  assert.equal(isOn(choices, 'AD_MEASUREMENT'), false);
  assert.equal(isOn(choices, 'PRIVACY_PASS'), false);
});

test('keeps choices it knows and offers the pass only with a price', () => {
  const offer = { choices: ['SALE_SHARE_OPT_OUT', 'NEW_THING', 'PRIVACY_PASS'] as never, passCents: 299, passDays: 30 };
  assert.deepEqual(known(offer), ['SALE_SHARE_OPT_OUT', 'PRIVACY_PASS']);
  assert.equal(passOffered(offer), true);
  assert.equal(passOffered({ ...offer, passCents: null }), false);
});

test('says the same words as the apps', () => {
  assert.equal(LABELS.SALE_SHARE_OPT_OUT, 'Do not sell or share my personal information');
  assert.equal(passButton(299, 30), 'Go without ads for 30 days, $2.99');
  assert.equal(money(500), '$5');
  assert.match(detail('SALE_SHARE_OPT_OUT', 'Hot Mess'), /^Hot Mess doesn’t sell/);
});
