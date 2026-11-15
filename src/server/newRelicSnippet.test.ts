import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// New Relic's snippet is replaced wholesale when the agent is updated, which would silently drop what we set in
// NREUM.init. These hold the filtering in place (see components/NewRelic.astro).
const snippet = readFileSync(new URL('../components/new-relic-browser.html', import.meta.url), 'utf8');
const line = snippet.split('\n').find((l) => l.includes('NREUM.init='));
assert.ok(line, 'the snippet sets NREUM.init');
const init = new Function(`const window = {}; let NREUM; ${line}; return NREUM.init;`)() as {
  privacy: { cookies_enabled: boolean };
  ajax: { capture_payloads: string };
  session_replay: { enabled: boolean };
  session_trace: { enabled: boolean };
  user_actions: { enabled: boolean };
  logging: { enabled: boolean };
  obfuscate: { regex: RegExp; replacement: string }[];
};

function sent(text: string): string {
  return init.obfuscate.reduce((out, rule) => out.replace(rule.regex, rule.replacement), text);
}

test('keeps nothing in the browser and records no sessions, clicks, logs or payloads', () => {
  assert.equal(init.privacy.cookies_enabled, false);
  assert.equal(init.session_replay.enabled, false);
  assert.equal(init.session_trace.enabled, false);
  assert.equal(init.user_actions.enabled, false);
  assert.equal(init.logging.enabled, false);
  assert.equal(init.ajax.capture_payloads, 'none');
});

test('rewrites IDs, share codes, the signed-in app, query values, emails and fragments', () => {
  const id = '6f1c2a3b-1111-2222-3333-444455556666';
  assert.equal(sent(`https://hotmess.social/venues/${id}`), 'https://hotmess.social/venues/:id');
  assert.equal(sent('https://hotmess.social/v/AbC123?e=v3.hash'), 'https://hotmess.social/v/:code?redacted');
  assert.equal(sent(`https://hotmess.social/app/pings/${id}`), 'https://hotmess.social/app');
  assert.equal(sent('/discover?q=bears&code=xyz&page=2'), '/discover?redacted?redacted&page=2');
  assert.equal(sent('oops for a.b@example.com'), 'oops for :email');
  assert.equal(sent('https://hotmess.social/#access_token=abc'), 'https://hotmess.social/');
});
