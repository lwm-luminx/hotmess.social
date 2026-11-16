// The cover and safety posters as PDFs (POST /poster/pdf). Browsers print HTML their own way: Safari keeps its own
// margins and headers whatever the page asks for, which pushed the poster up and cut its headline and footer. A PDF made
// here by Cloudflare's headless Chromium is the same everywhere, at the paper's exact size.
//
// The caller sends the poster's options, never HTML: the Worker builds the page from the same kit the preview uses
// (src/lib/poster/kit), with the font inlined, and the browser that renders it is allowed no network at all.
import { coverPosterHtml, COVER_PAPER_SIZES, type CoverPaper } from '../lib/poster/kit/Poster/cover';
import { POSTER_LANGUAGES, type PosterLanguage } from '../lib/poster/kit/Poster/i18n';
import { CODE_WORDS, SAFETY_PAPER_SIZES, safetyPosterHtml, type CodeWord, type SafetyPaper } from '../lib/poster/kit/Poster/safety';

const AUDIENCE = 'Hot Mess';

export interface PosterPdfRequest {
  kind: 'cover' | 'safety';
  venueName: string;
  link: string;
  paper: string;
  language: string;
  headline?: string;
  codeWord?: string;
  emergencyNumber?: string;
}

const oneOf = <T extends string>(options: readonly { value: T }[], value: unknown): T | null =>
  options.find((o) => o.value === value)?.value ?? null;
const text = (value: unknown, max: number) => (typeof value === 'string' && value.length <= max ? value : null);

/**
 * The poster's page for a request, or null when the request isn't one we print. The QR may only open this site's own
 * cover and help pages, so the endpoint can't be used to print a code for anywhere else.
 */
export function posterPdfHtml(body: unknown, origin: string, fontUrl: string): { html: string; file: string } | null {
  if (!body || typeof body !== 'object') return null;
  const r = body as Record<string, unknown>;
  const venueName = text(r.venueName, 120)?.trim();
  const link = text(r.link, 300);
  const language = oneOf<PosterLanguage>(POSTER_LANGUAGES, r.language);
  const headline = text(r.headline ?? '', 40);
  if (!venueName || !link || !language || headline === null) return null;
  const file = venueName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'venue';
  if (r.kind === 'cover') {
    const paper = oneOf<CoverPaper>(COVER_PAPER_SIZES, r.paper);
    if (!paper || !link.startsWith(`${origin}/cover/`)) return null;
    return {
      html: coverPosterHtml({ audienceName: AUDIENCE, venueName, link, headline, paper, language, riso: true, fontUrl }),
      file: `${file}-cover-poster.pdf`,
    };
  }
  if (r.kind === 'safety') {
    const paper = oneOf<SafetyPaper>(SAFETY_PAPER_SIZES, r.paper);
    const codeWord = oneOf<CodeWord>(CODE_WORDS, r.codeWord);
    const emergencyNumber = text(r.emergencyNumber ?? '', 12);
    if (!paper || !codeWord || emergencyNumber === null || !link.startsWith(`${origin}/help/`)) return null;
    return {
      html: safetyPosterHtml({
        audienceName: AUDIENCE, venueName, link, sampleLink: `${origin}/help`, headline, codeWord, emergencyNumber,
        paper, riso: true, language, fontUrl,
      }),
      file: `${file}-safety-poster.pdf`,
    };
  }
  return null;
}

/** The font as a data: URL, so the page needs nothing from the network. */
export async function fontDataUrl(font: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(font);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:font/woff2;base64,${btoa(binary)}`;
}

/** Prints the page to a PDF at its own @page size, with its backgrounds. */
export async function renderPdf(binding: unknown, html: string): Promise<Uint8Array> {
  const puppeteer = (await import('@cloudflare/puppeteer')).default;
  const browser = await puppeteer.launch(binding as Parameters<typeof puppeteer.launch>[0]);
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().startsWith('data:')) void request.continue();
      else void request.abort();
    });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    return await page.pdf({ preferCSSPageSize: true, printBackground: true });
  } finally {
    await browser.close();
  }
}
