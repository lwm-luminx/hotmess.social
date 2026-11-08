import { test } from 'node:test';
import assert from 'node:assert/strict';
import { venueShortCode, venueShortLink } from './venueShortLink.ts';

// Codes from audience_kit_api's VenueShortLink.code, which /v1/public/v/:code reverses.
test('a venue short code matches the API', () => {
  assert.equal(venueShortCode('11111111-1111-4111-8111-111111111111'), '2FbpUzu8');
  assert.equal(venueShortCode('FFFFFFFF-ffff-4fff-bfff-ffffffffffff'), 'DXLgGAi3');
  assert.equal(venueShortCode('0a3f9c2e-7b41-4d2a-9e10-5c6d7e8f9a0b'), '1BbW89vW');
  assert.equal(venueShortCode('00000000-0000-4000-8000-000000000000'), '00000000');
});

test('a venue short link is a /v/ link, and nothing for an ID that is not a UUID', () => {
  assert.equal(venueShortLink('11111111-1111-4111-8111-111111111111'), 'https://hotmess.social/v/2FbpUzu8');
  assert.equal(venueShortLink('Neighbours'), null);
  assert.equal(venueShortLink(''), null);
});
