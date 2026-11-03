import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beginInstagramSignIn, takeInstagramReturn } from './instagram.ts';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

test('sends only the SHA-256 of the verifier it keeps, with where to come back', async () => {
  const storage = new MemoryStorage();
  const url = new URL(await beginInstagramSignIn('https://api.audiencekit.com', 'https://hotmess.social/app/', storage as unknown as Storage));
  assert.equal(url.pathname, '/v1/token/instagram/authorize');
  assert.equal(url.searchParams.get('return_to'), 'https://hotmess.social/app/');
  const verifier = storage.getItem('hotmess.instagram')!;
  assert.match(verifier, /^[0-9a-f]{64}$/);
  assert.equal(url.searchParams.get('challenge'), await sha256Hex(verifier));
});

test('takes the ticket out of the address and storage, once', () => {
  const storage = new MemoryStorage();
  storage.setItem('hotmess.instagram', 'mine');
  const url = new URL('https://hotmess.social/app/?tab=now&instagram_ticket=sealed');
  assert.deepEqual(takeInstagramReturn(url, storage as unknown as Storage), { ticket: 'sealed', verifier: 'mine' });
  assert.equal(url.search, '?tab=now');
  assert.equal(takeInstagramReturn(url, storage as unknown as Storage), null);
});

test('reports a cancelled sign-in and a ticket from another tab', () => {
  const storage = new MemoryStorage() as unknown as Storage;
  assert.deepEqual(takeInstagramReturn(new URL('https://hotmess.social/app/?instagram_error=access_denied'), storage),
    { error: 'Instagram sign-in was cancelled.' });
  assert.deepEqual(takeInstagramReturn(new URL('https://hotmess.social/app/?instagram_ticket=sealed'), storage),
    { error: 'Start Instagram sign-in again from this page.' });
});
