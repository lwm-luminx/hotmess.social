// Copies what the AudienceKit console's poster builder prints from, so both builders print the same posters:
//   GET /v1/poster/slogans  the slogan library  -> src/lib/poster/slogans.json
//   GET /v1/poster/kit      the cover and safety poster modules (and their copy and QR code) -> src/lib/poster/kit/
// Run it after a line or a poster changes in audience_kit_api, then redraw the TV slides:
//   npm run sync-posters && node scripts/marquee-slides.mjs
// --check fails (exit 1) when a copy here differs from the API's, without writing; CI runs it.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.SLOGANS_API_BASE ?? process.env.PUBLIC_API_BASE ?? 'https://api.audiencekit.com';
const check = process.argv.includes('--check');
let drift = false;

async function fetchJson(path) {
  const response = await fetch(new URL(path, base), { headers: { accept: 'application/json' } });
  if (!response.ok) {
    console.error(`${base}${path} answered ${response.status}; the copy here is left as it is.`);
    process.exit(check ? 1 : 0);
  }
  return response.json();
}

// Writes `text` to `file` (relative to the repo), or in --check notes that it differs.
async function put(file, text, same = (current) => current === text) {
  const path = join(root, file);
  const current = await readFile(path, 'utf8').catch(() => null);
  if (current !== null && same(current)) return;
  if (check) { console.error(`${file} differs from the API's.`); drift = true; return; }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
  console.log(`${file} updated.`);
}

const library = await fetchJson('/v1/poster/slogans');
if (!Array.isArray(library.slogans) || !library.themes || !library.art) {
  console.error('The API answered something that is not a slogan library; nothing changed.');
  process.exit(1);
}
// One line per slogan, so a change reads as a one-line diff.
const block = (o) => JSON.stringify(o, null, 2).replace(/\n/g, '\n  ');
await put('src/lib/poster/slogans.json',
  `{\n  "themes": ${block(library.themes)},\n  "art": ${block(library.art)},\n  "slogans": [\n${library.slogans.map((s) => `    ${JSON.stringify(s)}`).join(',\n')}\n  ]\n}\n`,
  (current) => JSON.stringify(JSON.parse(current)) === JSON.stringify(library));

const kit = await fetchJson('/v1/poster/kit');
for (const [path, source] of Object.entries(kit.files ?? {})) {
  const file = normalize(path);
  if (file.startsWith('..') || !file.endsWith('.ts')) { console.error(`Skipping ${path}: not a kit module.`); continue; }
  await put(join('src/lib/poster/kit', file), source);
}

if (check) {
  if (drift) { console.error(`Run npm run sync-posters against ${base} and commit the result.`); process.exit(1); }
  console.log('The slogan library and the poster kit match the API.');
}
