import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dialogURL, parseCallback, type PendingLogin } from './login.ts';

const pending: PendingLogin = {
  state: 'abc', appID: '713525445368431',
  redirectURI: 'https://hotmess.social/app/', returnTo: '/venues/x',
};

test('a Business app opens the dialog with its config and no scope', () => {
  const url = new URL(dialogURL({ appID: '713525445368431', configID: '4085560021745660' }, pending.redirectURI, 'abc'));
  assert.equal(url.origin + url.pathname, 'https://www.facebook.com/v21.0/dialog/oauth');
  assert.equal(url.searchParams.get('client_id'), '713525445368431');
  assert.equal(url.searchParams.get('config_id'), '4085560021745660');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://hotmess.social/app/');
  assert.equal(url.searchParams.get('state'), 'abc');
  assert.equal(url.searchParams.has('scope'), false);
});

test('an app without a config asks for permissions', () => {
  const url = new URL(dialogURL({ appID: '1', configID: null }, pending.redirectURI, 'abc'));
  assert.equal(url.searchParams.get('scope'), 'public_profile,email');
  assert.equal(url.searchParams.has('config_id'), false);
});

test('a matching redirect yields the code', () => {
  assert.deepEqual(parseCallback('?code=xyz&state=abc', pending), { kind: 'code', code: 'xyz', pending });
});

test('a redirect for another login is refused', () => {
  assert.equal(parseCallback('?code=xyz&state=other', pending).kind, 'error');
  assert.equal(parseCallback('?code=xyz&state=abc', null).kind, 'error');
});

test('a cancelled dialog says so', () => {
  assert.deepEqual(parseCallback('?error=access_denied&error_reason=user_denied&state=abc', pending),
    { kind: 'error', message: 'Facebook sign-in was cancelled.' });
});

test('a plain page load is not a callback', () => {
  assert.deepEqual(parseCallback('', pending), { kind: 'none' });
});
