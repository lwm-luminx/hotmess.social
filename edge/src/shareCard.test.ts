import assert from 'node:assert/strict';
import { test } from 'node:test';
import { headTags, rewriteHead, type ShareCard } from './shareCard.ts';

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Hot Mess</title>
<meta name="description" content="Where your people are tonight"><meta name="apple-itunes-app" content="app-id=1195758383">
<meta property="og:site_name" content="Hot Mess"><meta property="og:title" content="Hot Mess">
<meta property="og:image" content="https://hotmess.social/og/hot-mess.png"><meta name="twitter:card" content="summary_large_image">
<meta property="fb:app_id" content="1168782378316790"></head><body></body></html>`;

const card: ShareCard = {
  kind: 'venue',
  id: '6f1c2c55-3b0e-4a8e-9d55-1f0f1a2b3c4d',
  url: 'https://hotmess.social/venues/6f1c2c55-3b0e-4a8e-9d55-1f0f1a2b3c4d',
  title: 'Queer/Bar "Capitol Hill"',
  description: 'Capitol Hill, Seattle',
  site_name: 'Hot Mess',
  image: { url: 'https://cdn.example/venue.jpg', width: 800, height: 800, alt: 'Queer/Bar' },
};

test('replaces the generic preview tags with the card', () => {
  const html = rewriteHead(page, headTags(card, '1195758383'));

  assert.equal(html.match(/<title>/g)?.length, 1);
  assert.match(html, /<title>Queer\/Bar &quot;Capitol Hill&quot; · Hot Mess<\/title>/);
  assert.equal(html.match(/property="og:title"/g)?.length, 1);
  assert.match(html, /property="og:image" content="https:\/\/cdn.example\/venue.jpg"/);
  assert.match(html, /name="apple-itunes-app" content="app-id=1195758383, app-argument=https:\/\/hotmess.social\/venues\//);
  assert.match(html, /property="fb:app_id"/, 'keeps the app id');
  assert.match(html, /name="twitter:card" content="summary"/, 'a square photo is a small card');
});

test('falls back to the site card without a photo', () => {
  const tags = headTags({ ...card, kind: 'person', image: null }, '1195758383');

  assert.match(tags, /og:image" content="https:\/\/hotmess.social\/og\/hot-mess.png"/);
  assert.match(tags, /og:type" content="profile"/);
  assert.match(tags, /twitter:card" content="summary_large_image"/);
});
