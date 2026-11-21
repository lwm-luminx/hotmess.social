import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayHandle, socialProfiles } from './poster/social.ts';

test('keeps known networks with https links, one each, in order, at most four', () => {
  const profiles = socialProfiles([
    { provider: 'tiktok', handle: 'kremwerk', url: 'https://tiktok.com/@kremwerk' },
    { provider: 'venmo', handle: 'tips', url: 'https://venmo.com/u/tips' },
    { provider: 'instagram', handle: '@kremwerk_sea', url: 'https://instagram.com/kremwerk_sea' },
    { provider: 'instagram', handle: 'second', url: 'https://instagram.com/second' },
    { provider: 'facebook', handle: 'kremwerk', url: 'http://facebook.com/kremwerk' },
    { provider: 'twitter', handle: 'krem', url: 'https://x.com/krem' },
    { provider: 'bluesky', handle: 'krem.bsky.social', url: 'https://bsky.app/profile/krem.bsky.social' },
    { provider: 'youtube', handle: 'kremtv', url: 'https://youtube.com/kremtv' },
    null, 'nope', { provider: 'threads', handle: '', url: 'https://threads.net/@' },
  ]);
  assert.deepEqual(profiles.map((p) => [p.network, p.handle]), [
    ['Instagram', '@kremwerk_sea'], ['TikTok', '@kremwerk'], ['X', '@krem'], ['Bluesky', '@krem.bsky.social'],
  ]);
  assert.deepEqual(socialProfiles(undefined), []);
});

test('words each handle as people look for it', () => {
  assert.equal(displayHandle('instagram', ' @@kiki '), '@kiki');
  assert.equal(displayHandle('facebook', 'Kremwerk'), 'Kremwerk');
  assert.equal(displayHandle('youtube', 'kremtv'), '@kremtv');
  assert.equal(displayHandle('youtube', 'channel/UC123'), 'channel/UC123');
  assert.equal(displayHandle('linktree', 'kremwerk'), 'linktr.ee/kremwerk');
  assert.equal(displayHandle('discord', 'abc123'), 'discord.gg/abc123');
});
