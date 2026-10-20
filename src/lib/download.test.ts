import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_STORE_URL, PLAY_STORE_URL, downloadUrl } from './download.ts';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const FACEBOOK_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22A3354 [FBAN/FBIOS;FBAV/480.0.0.0]';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

test('iOS devices go to the App Store', () => {
  assert.equal(downloadUrl(IPHONE), APP_STORE_URL);
  assert.equal(downloadUrl(FACEBOOK_IOS), APP_STORE_URL);
  assert.equal(downloadUrl(IPAD_DESKTOP, 5), APP_STORE_URL);
});

test('Android goes to Google Play', () => {
  assert.equal(downloadUrl(ANDROID), PLAY_STORE_URL);
});

test('desktops get the page with both links', () => {
  assert.equal(downloadUrl(IPAD_DESKTOP), null);
  assert.equal(downloadUrl(WINDOWS), null);
  assert.equal(downloadUrl(''), null);
});
