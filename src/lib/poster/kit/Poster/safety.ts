import { printedDomain, qrSvg } from './classic'
import { pageLang, POSTER_STRINGS, posterStrings, type PosterLanguage } from './i18n'

// The safety poster (doc/design-system/Posters.md, "Safety poster"): a QR code that lets anyone at the venue tell its
// staff on shift they feel unsafe, with or without the app (the venue's SafetyPoster code, <web app>/help/<code>),
// and the code words a guest can say at the bar instead. One HTML page, like the classic poster, so the preview is
// what prints.

export type SafetyPaper = 'letter' | 'a4' | 'card'

export const SAFETY_PAPER_SIZES: Array<{ value: SafetyPaper; label: string }> = [
    { value: 'letter', label: 'US Letter (8.5 × 11 in)' },
    { value: 'a4', label: 'A4 (210 × 297 mm)' },
    { value: 'card', label: 'Mirror or stall card (5 × 7 in)' },
]

/**
 * Which code words the poster teaches. The Angel Shot is the US one (neat, on the rocks, with lime); "Ask for
 * Angela" is the UK and Australian one. Only print what the venue's staff have been told.
 */
export type CodeWord = 'angel_shot' | 'ask_for_angela' | 'none'

export const CODE_WORDS: Array<{ value: CodeWord; label: string }> = [
    { value: 'angel_shot', label: 'Angel Shot: neat, on the rocks, with lime' },
    { value: 'ask_for_angela', label: 'Ask for Angela' },
    { value: 'none', label: 'No code word, just the QR code' },
]

/** The three Angel Shot orders and what staff do for each, as the English poster prints them (i18n.ts has each language's). */
export const ANGEL_SHOT: Array<{ order: string; detail: string; action: string }> = POSTER_STRINGS.en.safety.angelShot

export interface SafetyPosterOptions {
    audienceName: string
    venueName: string
    /** The venue's safety poster link (SafetyPoster.url); null prints a sample code marked SAMPLE. */
    link: string | null
    /** What the sample code points at before the venue has a code: the audience's web app. */
    sampleLink: string
    headline: string
    codeWord: CodeWord
    /** The number printed at the bottom for danger right now ("911"). */
    emergencyNumber: string
    paper: SafetyPaper
    /** Hot Mess's riso pink and blue; every other audience prints in ink only. */
    riso: boolean
    /** An absolute URL for Figtree, so the poster's own window can load it. */
    fontUrl: string
    /** The language the poster prints in; English when left out. */
    language?: PosterLanguage
}

export const DEFAULT_SAFETY_HEADLINE = POSTER_STRINGS.en.safety.headline

/** The headline a safety poster starts with in each language. */
export const safetyHeadline = (language: PosterLanguage) => posterStrings(language).safety.headline

/** Whether the headline is one of the languages' defaults, so changing language can change it too. */
export const isDefaultSafetyHeadline = (headline: string) =>
    (['en', 'es', 'en-es'] as const).some((l) => safetyHeadline(l) === headline.trim())

const escape = (value: string) => value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const PAGES: Record<SafetyPaper, { width: number; height: number; css: [string, string] }> = {
    letter: { width: 8.5, height: 11, css: ['8.5in', '11in'] },
    a4: { width: 8.27, height: 11.69, css: ['210mm', '297mm'] },
    card: { width: 5, height: 7, css: ['5in', '7in'] },
}

function codeWordBlock(codeWord: CodeWord, inch: (n: number) => string, language: PosterLanguage): string {
    if (codeWord === 'none') return ''
    const t = posterStrings(language).safety
    if (codeWord === 'ask_for_angela') {
        return `<section class="words">
    <div class="eyebrow">${t.orAskAtBar}</div>
    <h2>${t.angelaQuestion}</h2>
    <p>${t.angelaBody}</p>
  </section>`
    }
    const rows = t.angelShot.map((shot, i) => `<li class="shot shot-${i}">
      <div class="order"><b>${shot.order}</b><span>${shot.detail}</span>${shot.english ? `<i lang="en">${shot.english}</i>` : ''}</div>
      <div class="arrow" aria-hidden="true"><svg viewBox="0 0 24 12" width="${inch(0.34)}" height="${inch(0.17)}"><path d="M0 6h20M15 1l6 5-6 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="action">${shot.action}</div>
    </li>`)
    return `<section class="words">
    <div class="eyebrow">${t.orOrderAtBar}</div>
    <ul class="shots">${rows.join('')}</ul>
    <p class="small">${t.noScene}</p>
  </section>`
}

/**
 * Hot Mess's after-dark look for the safety poster: it hangs in a bar bathroom, so it should look like it belongs
 * there (a dark wall, riso grain, a neon headline), not like a clinic notice. The QR stays black on a white card and
 * every line stays high-contrast, so it reads under dim, coloured light.
 */
function nightStyles(inch: (n: number) => string): string {
    const grain = 'url("data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .09 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>',
    ) + '")'
    return `
  :root { --night: #160c1c; --glow: #ff3d9a; --light: #fbeef6; --soft: #d9c3d3; }
  html, body { background: var(--night); color: var(--light); }
  .page { background:
      radial-gradient(ellipse at 85% 4%, rgba(255, 61, 154, .32), transparent 46%),
      radial-gradient(ellipse at 6% 96%, rgba(26, 140, 255, .26), transparent 50%),
      ${grain}, var(--night); }
  .band.ink { background: var(--light); }
  h1 { color: #fff; text-shadow: ${inch(-0.04)} ${inch(-0.02)} 0 var(--pink), ${inch(0.04)} ${inch(0.02)} 0 var(--blue),
    0 0 ${inch(0.28)} rgba(255, 61, 154, .55); }
  .kicker { color: var(--soft); }
  .kicker b { color: #fff; }
  .card { color: var(--ink); border-color: #fff; }
  .words h2 { color: #fff; }
  .words > p, .small { color: var(--soft); }
  .words > p strong { color: #fff; }
  .shot { background: rgba(255, 255, 255, .08); color: var(--light); }
  .shot-2 { border-color: var(--light); }
  .shot-2 .order span { color: var(--light); }
  .order i { color: var(--soft); }
  .arrow { color: var(--soft); }
  footer { color: var(--soft); }
  footer .call, footer b { color: #fff; }
  .sparkle { position: absolute; z-index: 0; color: var(--glow); opacity: .75; }`
}

const SPARKLE = '<svg viewBox="-10 -10 20 20"><path d="M0-10Q0 0 10 0Q0 0 0 10Q0 0-10 0Q0 0 0-10Z" fill="currentColor"/></svg>'

function sparkles(inch: (n: number) => string): string {
    const spots: Array<[number, number, number, string]> = [[7.4, 0.35, 0.34, '#ff3d9a'], [7.9, 1.05, 0.18, '#1a8cff'],
        [0.25, 6.6, 0.22, '#1a8cff'], [7.95, 7.4, 0.26, '#ff3d9a'], [0.3, 10.2, 0.16, '#ffe08a']]
    return spots.map(([x, y, size, color]) => `<div class="sparkle" style="left:${inch(x)};top:${inch(y)};width:${inch(size)};height:${inch(size)};color:${color}">${SPARKLE}</div>`).join('')
}

/**
 * The printable safety poster: "Need help?", the QR card ("Scan to tell staff, quietly"), the code words, and the
 * number to call in danger right now. Before the venue turns its code on, the QR is a sample and the page says so.
 */
export function safetyPosterHtml(poster: SafetyPosterOptions): string {
    const page = PAGES[poster.paper]
    const scale = page.width / 8.5
    const inch = (n: number) => `${(n * scale).toFixed(3)}in`
    const pt = (n: number) => `${(n * scale).toFixed(2)}pt`
    const [width, height] = page.css
    const pink = poster.riso ? '#ff3d9a' : '#1a1519'
    const blue = poster.riso ? '#1a8cff' : '#8a8088'
    const venue = escape(poster.venueName)
    const audience = escape(poster.audienceName)
    const link = poster.link ?? poster.sampleLink
    const sample = poster.link === null
    const words = poster.codeWord !== 'none'
    const qrSize = words ? 2.9 : 3.6
    const emergency = escape(poster.emergencyNumber.trim())
    // "NEED HELP?" prints at 66pt; a longer headline ("¿NECESITAS AYUDA?") shrinks to stay on one line where it can,
    // so the bands under it and the footer stay on the page.
    // A bilingual headline ("Need help? · ¿Necesitas ayuda?") prints its second language as a smaller line under it.
    const headlineText = poster.headline.trim() || posterStrings(poster.language ?? 'en').safety.headline
    const [headlineMain, headlineAlt] = headlineText.split(' · ', 2)
    const headlineSize = Math.max(34, Math.min(66, 545 / (headlineMain.length * 0.66)))
    const language = poster.language ?? 'en'
    const t = posterStrings(language)
    return `<!doctype html>
<html lang="${pageLang(language)}">
<head>
<meta charset="utf-8">
<title>${t.safety.title(venue)}</title>
<style>
  @font-face { font-family: 'Figtree'; src: url(${JSON.stringify(poster.fontUrl)}) format('woff2'); font-weight: 300 900; }
  @page { size: ${width} ${height}; margin: 0; }
  :root { --ink: #1a1519; --paper: #f6eff3; --pink: ${pink}; --blue: ${blue}; --muted: #5a4f57; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${width}; height: ${height}; background: var(--paper); color: var(--ink);
    font-family: 'Figtree', -apple-system, 'Helvetica Neue', Arial, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { position: relative; width: ${width}; height: ${height}; padding: ${inch(0.5)} ${inch(0.55)} ${inch(0.42)};
    overflow: hidden; display: flex; flex-direction: column; break-inside: avoid; }
  .page > * { flex-shrink: 0; }
  /* The gaps between the blocks give way first when the page is shorter than the paper (a browser that keeps its own
     margins or adds headers), so the headline and the footer stay on the page instead of being cut off. */
  .gap { flex: 0 1 var(--gap); min-height: calc(var(--gap) / 4); }
  .gap-card { --gap: ${inch(0.78)}; }
  .gap-words { --gap: ${inch(0.42)}; }
  .bi .gap-card { --gap: ${inch(0.62)}; }
  .bi .gap-words { --gap: ${inch(0.28)}; }
  /* Printed, the page fills whatever area the print dialog gives it, rather than the paper's full size. */
  @media print {
    html, body { width: 100%; height: 100%; }
    .page { width: 100%; height: 100vh; }
  }
  .bands { position: relative; height: 0; }
  .band { position: absolute; left: -1.6in; right: -1.6in; height: ${inch(0.16)}; transform: rotate(-4deg); }
  .band.pink { background: var(--pink); top: ${inch(0.2)}; }
  .band.ink { background: var(--ink); top: ${inch(0.25)}; }
  .band.blue { background: var(--blue); top: ${inch(0.3)}; }
  .h1alt { display: block; margin-top: ${inch(0.06)}; font-size: .48em; letter-spacing: -0.01em; }
  .bi .kicker { font-size: ${pt(13)}; }
  .bi .card { padding: ${inch(0.2)} ${inch(0.28)}; }
  .bi .qr { width: ${inch(qrSize * 0.8)}; height: ${inch(qrSize * 0.8)}; }
  .bi .card h2 { font-size: ${pt(20)}; }
  .bi .card p { font-size: ${pt(10.5)}; }
  .bi .shot { padding: ${inch(0.06)} ${inch(0.18)}; }
  .bi .order b { font-size: ${pt(16)}; }
  .bi .order span { font-size: ${pt(11)}; }
  .bi .action { font-size: ${pt(11.5)}; }
  .bi .words > p, .bi .small { font-size: ${pt(11)}; }
  header { position: relative; z-index: 1; }
  h1 { font-weight: 900; font-size: ${pt(headlineSize)}; line-height: .9; letter-spacing: -0.03em; text-transform: uppercase;
    text-shadow: ${inch(-0.04)} ${inch(-0.02)} 0 var(--pink), ${inch(0.04)} ${inch(0.02)} 0 var(--blue); overflow-wrap: anywhere; }
  .kicker { margin-top: ${inch(0.12)}; font-size: ${pt(15.5)}; font-weight: 700; color: var(--muted); max-width: ${inch(6.6)}; }
  .kicker b { color: var(--ink); font-weight: 900; }
  .card { position: relative; z-index: 1; background: #fff; border: ${inch(0.03)} solid var(--ink);
    border-radius: ${inch(0.28)}; padding: ${inch(0.26)} ${inch(0.32)};
    box-shadow: ${inch(0.1)} ${inch(0.1)} 0 var(--pink), ${inch(0.18)} ${inch(0.18)} 0 var(--blue);
    display: flex; align-items: center; gap: ${inch(0.3)}; }
  .card .qrwrap { position: relative; flex: none; }
  .qr { width: ${inch(qrSize)}; height: ${inch(qrSize)}; display: block; }
  .sample { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
  .sample span { background: var(--pink); color: #fff; font-weight: 900; font-size: ${pt(20)}; letter-spacing: .16em;
    padding: ${inch(0.06)} ${inch(0.16)}; transform: rotate(-12deg); border: ${inch(0.03)} solid var(--ink); }
  .card .copy { display: flex; flex-direction: column; gap: ${inch(0.1)}; min-width: 0; }
  .eyebrow { font-weight: 900; font-size: ${pt(12)}; letter-spacing: .16em; text-transform: uppercase; color: var(--pink); }
  .card h2 { font-weight: 900; font-size: ${pt(25)}; line-height: 1.04; letter-spacing: -0.01em; }
  .card p { font-size: ${pt(12)}; line-height: 1.34; font-weight: 600; color: var(--muted); }
  .card p strong { color: var(--ink); font-weight: 800; }
  .url { font-size: ${pt(12.5)}; font-weight: 900; overflow-wrap: anywhere; }
  .words { position: relative; z-index: 1; }
  .words h2 { font-weight: 900; font-size: ${pt(30)}; line-height: 1.02; margin-top: ${inch(0.06)}; }
  .words > p { margin-top: ${inch(0.08)}; font-size: ${pt(13.5)}; line-height: 1.35; font-weight: 600; color: var(--muted); }
  .words > p strong { color: var(--ink); font-weight: 900; }
  .shots { list-style: none; margin-top: ${inch(0.1)}; display: flex; flex-direction: column; gap: ${inch(0.1)}; }
  .shot { display: grid; grid-template-columns: ${inch(2.55)} ${inch(0.42)} 1fr; align-items: center;
    border-left: ${inch(0.09)} solid var(--pink); background: #fff; border-radius: 0 ${inch(0.16)} ${inch(0.16)} 0;
    padding: ${inch(0.1)} ${inch(0.2)}; }
  .shot-1 { border-color: var(--blue); }
  .shot-2 { border-color: var(--ink); }
  .order b { display: block; font-weight: 900; font-size: ${pt(19)}; line-height: 1; }
  .order span { display: block; margin-top: ${inch(0.03)}; font-weight: 900; font-size: ${pt(13.5)}; text-transform: uppercase;
    letter-spacing: .1em; color: var(--pink); }
  .order i { display: block; margin-top: ${inch(0.02)}; font-style: normal; font-weight: 700; font-size: ${pt(10.5)};
    letter-spacing: .04em; color: var(--muted); }
  .shot-1 .order span { color: var(--blue); }
  .shot-2 .order span { color: var(--ink); }
  .arrow { color: var(--muted); display: flex; }
  .action { font-size: ${pt(13.5)}; font-weight: 700; line-height: 1.25; }
  .small { margin-top: ${inch(0.1)}; font-size: ${pt(11.5)}; font-weight: 600; color: var(--muted); }
  footer { margin-top: auto; padding-top: ${inch(0.16)}; display: flex; justify-content: space-between; align-items: flex-end;
    gap: ${inch(0.3)}; font-size: ${pt(11)}; font-weight: 600; color: var(--muted); position: relative; z-index: 1; }
  footer .call { font-size: ${pt(14)}; color: var(--ink); font-weight: 800; }
  footer .call b { font-weight: 900; font-size: ${pt(19)}; color: var(--pink); }
  footer b { color: var(--ink); font-weight: 800; }
  .alt { display: block; margin-top: ${inch(0.03)}; font-style: italic; font-weight: 600; opacity: .82; }
${poster.riso ? nightStyles(inch) : ''}
</style>
</head>
<body>
<div class="page${language === 'en-es' ? ' bi' : ''}">
  ${poster.riso ? sparkles(inch) : ''}
  <header>
    <h1>${escape(headlineMain)}${headlineAlt ? `<span class="h1alt">${escape(headlineAlt)}</span>` : ''}</h1>
    <div class="kicker">${t.safety.kicker(venue)}</div>
  </header>
  <div class="bands"><div class="band pink"></div><div class="band ink"></div><div class="band blue"></div></div>
  <div class="gap gap-card"></div>
  <section class="card">
    <div class="qrwrap">${qrSvg(link)}${sample ? '<div class="sample"><span>SAMPLE</span></div>' : ''}</div>
    <div class="copy">
      <div class="eyebrow">${t.scanWithCamera}</div>
      <h2>${t.safety.tellStaff}</h2>
      <p>${t.safety.tellStaffBody}</p>
      <div class="url">${escape(printedDomain(link))}/help</div>
    </div>
  </section>
  ${poster.codeWord === 'none' ? '' : '<div class="gap gap-words"></div>'}
  ${codeWordBlock(poster.codeWord, inch, language)}
  <footer>
    <div class="call">${emergency ? t.safety.inDanger(emergency) : ''}</div>
    <div><b>${venue}</b> · ${audience}</div>
  </footer>
</div>
</body>
</html>
`
}
