import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeUrl, shareCaption, shareFormat, shareLink } from './poster/share.ts';
import { sloganById } from './poster/slogans.ts';

const NONE = { night: '', venue: '', when: '', link: '' };
const NIGHT = { night: 'Bear Night', venue: 'Neighbours · Seattle', when: 'Every week on Thursday · 9 PM', link: 'https://hotmess.social/v/abc' };

test('each network gets a size it takes: the poster\'s own when it fits, else its best', () => {
  assert.equal(shareFormat('instagram', 'post'), 'post');
  assert.equal(shareFormat('instagram', 'letter'), 'portrait');
  assert.equal(shareFormat('story', 'post'), 'story');
  assert.equal(shareFormat('x', 'letter'), 'wide');
  assert.equal(shareFormat('x', 'post'), 'post');
});

test('the caption is the line, the night and the hashtag; the link is the night\'s, else the download page', () => {
  const slogan = sloganById('latin-roll-rs')!;
  assert.equal(shareCaption(slogan, NIGHT), `Latin night, for those who can roll their Rs.\nBear Night · Every week on Thursday · 9 PM · Neighbours · Seattle\n#HotMess`);
  assert.match(shareCaption(slogan, NONE, 'en-es'), /\nNoche latina/);
  assert.match(shareCaption(slogan, NONE, 'es'), /^Noche latina.*\n#HotMess #NocheGay$/s);
  assert.equal(shareLink(NIGHT), NIGHT.link);
  assert.equal(shareLink(NONE), 'https://hotmess.social/download');
});

test('computers open the composer with the caption; Instagram, which has none, opens to upload', () => {
  assert.equal(composeUrl('x', 'Hi there', 'https://hotmess.social/v/abc'), 'https://x.com/intent/post?text=Hi%20there&url=https%3A%2F%2Fhotmess.social%2Fv%2Fabc');
  assert.equal(composeUrl('bluesky', 'Hi', 'https://h.s/x'), 'https://bsky.app/intent/compose?text=Hi%20https%3A%2F%2Fh.s%2Fx');
  assert.equal(composeUrl('facebook', 'Hi', 'https://h.s/x'), 'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fh.s%2Fx');
  assert.equal(composeUrl('instagram', 'Hi', 'https://h.s/x'), 'https://www.instagram.com/');
});
