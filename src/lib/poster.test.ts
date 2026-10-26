import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLOGANS, THEMES, plainText, posterWords, slogansFor } from './poster/slogans.ts';
import { jpegPdf } from './poster/pdf.ts';

test('adult-venue lines only show for a flagged venue', () => {
  const general = slogansFor(false);
  assert.ok(general.length > 0);
  assert.ok(general.every((s) => s.rating === 'general'));
  assert.ok(slogansFor(true).some((s) => s.rating === 'adult_venue'));
  assert.equal(slogansFor(true).length, SLOGANS.length);
});

test('every line has a known theme, art and a unique id', () => {
  assert.equal(new Set(SLOGANS.map((s) => s.id)).size, SLOGANS.length);
  for (const s of SLOGANS) {
    assert.ok(s.theme in THEMES, s.id);
    assert.ok(s.art.length >= 1 && s.art.length <= 2, s.id);
    assert.equal((s.text.match(/\*/g) ?? []).length % 2, 0, `${s.id} has an unclosed accent`);
  }
});

test('accent words are the ones between asterisks', () => {
  assert.deepEqual(posterWords("You're a beautiful person, not a *profitable product*."), [
    { text: "YOU'RE", accent: false }, { text: 'A', accent: false }, { text: 'BEAUTIFUL', accent: false },
    { text: 'PERSON,', accent: false }, { text: 'NOT', accent: false }, { text: 'A', accent: false },
    { text: 'PROFITABLE', accent: true }, { text: 'PRODUCT.', accent: true },
  ]);
  assert.deepEqual(posterWords('*Conversation:* the original').map((w) => w.accent), [true, false, false]);
  assert.equal(plainText('Swipe less. *Sweat more.*'), 'Swipe less. Sweat more.');
});

test('the PDF wraps the JPEG in one page with a valid cross-reference table', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
  const pdf = jpegPdf(jpeg, 2550, 3300, 612, 792);
  const text = new TextDecoder('latin1').decode(pdf);
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.endsWith('%%EOF\n'));
  assert.match(text, /\/MediaBox \[0 0 612 792\]/);
  assert.match(text, /\/Width 2550 \/Height 3300/);
  assert.match(text, /\/Length 7 >>/);
  const startxref = Number(text.match(/startxref\n(\d+)/)![1]);
  assert.ok(text.slice(startxref).startsWith('xref'));
  const offsets = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  assert.equal(offsets.length, 5);
  offsets.forEach((o, i) => assert.ok(text.slice(o).startsWith(`${i + 1} 0 obj`), `object ${i + 1}`));
});

test('the TV slides are every line but the ones awaiting legal review, adult ones only where flagged', async () => {
  const { marqueeManifest, marqueeSlogans, slidesFor } = await import('./poster/marquee.ts');
  const lines = marqueeSlogans();
  assert.ok(!lines.some((s) => s.id === 'grinding-grindr'));
  const manifest = marqueeManifest();
  assert.ok(slidesFor(manifest, false).every((s) => !s.adult));
  assert.equal(slidesFor(manifest, true).length, lines.length);
});

test('the drawn TV slides match the slogan library (re-run scripts/marquee-slides.mjs after changing it)', async () => {
  const { readFile, access } = await import('node:fs/promises');
  const { marqueeManifest } = await import('./poster/marquee.ts');
  const drawn = JSON.parse(await readFile(new URL('../../public/marquee/slogans.json', import.meta.url), 'utf8'));
  assert.deepEqual(drawn, marqueeManifest());
  for (const slide of drawn.slides) await access(new URL(`../../public${slide.image}`, import.meta.url));
});
