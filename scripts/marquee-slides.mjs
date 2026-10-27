// Draws the TV slogan slides (src/lib/poster/marquee.ts) into public/marquee/: each line at 1920 × 1080 with the app
// download code, as a JPEG, plus slogans.json, the manifest the screens read. Run it after changing the slogan
// library or the poster engine:  node scripts/marquee-slides.mjs
// It runs the poster engine in Chromium (Playwright), with the poster fonts from public/fonts/poster.
import { build } from 'esbuild';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/marquee');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('@playwright/test')); }

const bundle = await build({
  stdin: {
    contents: `import { renderPoster, loadPosterFonts } from './src/lib/poster/render.ts';
      import { marqueeManifest, marqueeSlogans, marqueeLook } from './src/lib/poster/marquee.ts';
      window.marquee = { renderPoster, loadPosterFonts, marqueeManifest, marqueeSlogans, marqueeLook };`,
    resolveDir: root, loader: 'ts',
  },
  bundle: true, write: false, format: 'iife', platform: 'browser',
});

const fonts = [
  ['Big Shoulders Display', 'big-shoulders-display-latin-700-normal', 700],
  ['Big Shoulders Display', 'big-shoulders-display-latin-900-normal', 900],
  ['Caveat Brush', 'caveat-brush-latin-400-normal', 400],
  ['Archivo', 'archivo-latin-400-normal', 400],
  ['Archivo', 'archivo-latin-600-normal', 600],
  ['Archivo', 'archivo-latin-800-normal', 800],
].map(([family, file, weight]) => `@font-face { font-family: "${family}"; src: url("/fonts/poster/${file}.woff2") format("woff2"); font-weight: ${weight}; }`).join('\n');

// CHROMIUM points at a browser other than Playwright's own, if that isn't installed.
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage();
// Serve the page and the fonts from a made-up origin, so @font-face loads them.
await page.route('https://slides.local/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><style>${fonts}</style><body></body>` });
  return route.fulfill({ path: join(root, 'public', path) });
});
await page.goto('https://slides.local/');
await page.addScriptTag({ content: bundle.outputFiles[0].text });
await page.evaluate(() => window.marquee.loadPosterFonts());

const manifest = await page.evaluate(() => window.marquee.marqueeManifest());
await mkdir(out, { recursive: true });
for (const old of await readdir(out)) if (old.endsWith('.jpg')) await rm(join(out, old));
const lines = await page.evaluate(() => window.marquee.marqueeSlogans().map((s) => s.id));
for (const [index, id] of lines.entries()) {
  const data = await page.evaluate(({ id, index }) => {
    const m = window.marquee, canvas = document.createElement('canvas');
    m.renderPoster(canvas, { slogan: id, format: 'tv', style: m.marqueeLook(index), art: 'auto', qr: 'download',
      event: { night: '', venue: '', when: '', link: '' } }, 1);
    return canvas.toDataURL('image/jpeg', 0.86);
  }, { id, index });
  const slide = manifest.slides[index];
  await writeFile(join(root, 'public', slide.image), Buffer.from(data.split(',')[1], 'base64'));
  console.log(slide.image);
}
await writeFile(join(out, 'slogans.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await browser.close();
