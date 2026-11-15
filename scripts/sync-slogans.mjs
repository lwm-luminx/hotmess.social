// Copies the poster slogan library from AudienceKit (GET /v1/poster/slogans, the same file the console's poster
// builder reads) into src/lib/poster/slogans.json, so both builders print the same lines. Run it after a line changes
// in audience_kit_api, then redraw the TV slides:  npm run sync-slogans && node scripts/marquee-slides.mjs
// --check fails (exit 1) when the copy here differs from the API's, without writing; CI runs it.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'src/lib/poster/slogans.json');
const base = process.env.SLOGANS_API_BASE ?? process.env.PUBLIC_API_BASE ?? 'https://api.next.audiencekit.com';
const check = process.argv.includes('--check');

const response = await fetch(new URL('/v1/poster/slogans', base), { headers: { accept: 'application/json' } });
if (!response.ok) {
  console.error(`${base}/v1/poster/slogans answered ${response.status}; slogans.json left as it is.`);
  process.exit(check ? 1 : 0);
}
const library = await response.json();
if (!Array.isArray(library.slogans) || !library.themes || !library.art) {
  console.error('The API answered something that is not a slogan library; slogans.json left as it is.');
  process.exit(1);
}

// One line per slogan, so a change reads as a one-line diff.
const block = (o) => JSON.stringify(o, null, 2).replace(/\n/g, '\n  ');
const text = `{\n  "themes": ${block(library.themes)},\n  "art": ${block(library.art)},\n  "slogans": [\n${library.slogans.map((s) => `    ${JSON.stringify(s)}`).join(',\n')}\n  ]\n}\n`;
const current = await readFile(file, 'utf8').catch(() => '');
if (check) {
  if (JSON.stringify(JSON.parse(current)) === JSON.stringify(library)) { console.log('slogans.json matches the API.'); process.exit(0); }
  console.error(`slogans.json differs from ${base}/v1/poster/slogans. Run npm run sync-slogans and commit it.`);
  process.exit(1);
}
if (current === text) console.log('slogans.json already matches the API.');
else { await writeFile(file, text); console.log(`slogans.json updated: ${library.slogans.length} lines.`); }
