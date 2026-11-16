import { printedDomain, qrSvg } from './classic'
import { pageLang, type PosterLanguage, type PosterTongue } from './i18n'
import { venueShortCode } from './venueShortLink'

// The cover poster (doc/design-system/Posters.md, "Cover poster"): for a venue's lobby or line, a QR code that opens
// tonight's cover at the venue, <web app>/cover/<venue short code>. The code is the venue's short link code
// (VenueShortLink), so nothing is stored and it never expires; what it sells is worked out when it's scanned
// (CoverPoster on the API): tonight, or the next night with something on when nothing is on tonight. On an iPhone the
// App Clip pays with Apple Pay, no download; Hot Mess opens it if it's installed; everyone else pays on the web page.
// One HTML page, like the safety poster, so the preview is what prints.

export type CoverPaper = 'letter' | 'a4' | 'tabloid' | 'card'

export const COVER_PAPER_SIZES: Array<{ value: CoverPaper; label: string }> = [
    { value: 'letter', label: 'US Letter (8.5 × 11 in)' },
    { value: 'a4', label: 'A4 (210 × 297 mm)' },
    { value: 'tabloid', label: 'Lobby poster (11 × 17 in)' },
    { value: 'card', label: 'Counter card (5 × 7 in)' },
]

interface CoverCopy {
    headline: string
    kicker: (venue: string) => string
    eyebrow: string
    cardTitle: string
    cardBody: (app: string) => string
    steps: [string, string, string]
    always: string
    title: (venue: string) => string
}

/**
 * Every word the poster prints, per language. Spanish is Latin American, for Mexico and the US: tú, and "cover", the
 * word Mexican venues use at the door.
 */
export const COVER_COPY: Record<PosterTongue, CoverCopy> = {
    en: {
        headline: 'Pay cover here',
        kicker: (venue) => `Skip the cash. Pay tonight’s cover at <b>${venue}</b> on your phone and show your pass at the door.`,
        eyebrow: 'Scan with your camera',
        cardTitle: 'Tonight’s cover in a tap',
        cardBody: (app) => `On an iPhone it opens right from the camera with Apple Pay, <strong>no download</strong>. Have ${app}? It opens there. Android works in your browser.`,
        steps: ['Scan', 'Pay', 'Show your pass at the door'],
        always: 'This code always opens tonight. Nothing on? It shows the next night.',
        title: (venue) => `${venue} cover poster`,
    },
    es: {
        headline: 'Paga el cover aquí',
        kicker: (venue) => `No necesitas efectivo. Paga el cover de esta noche en <b>${venue}</b> desde tu celular y muestra tu pase en la puerta.`,
        eyebrow: 'Escanea con tu cámara',
        cardTitle: 'El cover de hoy en un toque',
        cardBody: (app) => `En iPhone se abre directo desde la cámara con Apple Pay, <strong>sin descargar nada</strong>. ¿Tienes ${app}? Se abre ahí. En Android funciona en tu navegador.`,
        steps: ['Escanea', 'Paga', 'Muestra tu pase en la puerta'],
        always: 'Este código siempre abre la noche de hoy. ¿No hay evento hoy? Te muestra la próxima noche.',
        title: (venue) => `Cartel de cover de ${venue}`,
    },
}

const alt = (en: string, es: string) => `${en}<span class="alt" lang="es">${es}</span>`

/**
 * The poster's lines in a language. Both languages (doc/design-system/Posters.md, "Languages") print short lines as
 * "English · Español" and paragraphs as English with the Spanish under it, like every other poster.
 */
export function coverCopy(language: PosterLanguage): CoverCopy {
    if (language !== 'en-es') return COVER_COPY[language]
    const { en, es } = COVER_COPY
    return {
        headline: `${en.headline} · ${es.headline}`,
        kicker: (venue) => alt(en.kicker(venue), es.kicker(venue)),
        eyebrow: 'Scan · Escanea',
        cardTitle: alt(en.cardTitle, es.cardTitle),
        cardBody: (app) => alt(en.cardBody(app), es.cardBody(app)),
        steps: ['Scan · Escanea', 'Pay · Paga', alt(en.steps[2], es.steps[2])],
        always: alt(en.always, es.always),
        title: (venue) => `${en.title(venue)} · ${es.title(venue)}`,
    }
}

export interface CoverPosterOptions {
    audienceName: string
    venueName: string
    /** The poster's link, <web app>/cover/<code> (coverPosterLink). */
    link: string
    /** Empty prints the language's own headline. */
    headline: string
    paper: CoverPaper
    language: PosterLanguage
    /** Hot Mess's riso pink and blue; every other audience prints in ink only. */
    riso: boolean
    /** An absolute URL for Figtree, so the poster's own window can load it. */
    fontUrl: string
}

/** `<webUrl>/cover/<code>` for the venue, or null for an ID that isn't a UUID. */
export function coverPosterLink(webUrl: string, venueId: string): string | null {
    const code = venueShortCode(venueId)
    return code ? `${webUrl.replace(/\/+$/, '')}/cover/${code}` : null
}

const escape = (value: string) => value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const PAGES: Record<CoverPaper, { width: number; css: [string, string] }> = {
    letter: { width: 8.5, css: ['8.5in', '11in'] },
    a4: { width: 8.27, css: ['210mm', '297mm'] },
    tabloid: { width: 11, css: ['11in', '17in'] },
    card: { width: 5, css: ['5in', '7in'] },
}

/**
 * The printable cover poster: the headline ("Pay cover here"), the QR card, Scan · Pay · Show your pass, and the
 * promise that the code always opens tonight.
 */
export function coverPosterHtml(poster: CoverPosterOptions): string {
    const copy = coverCopy(poster.language)
    const bilingual = poster.language === 'en-es'
    const page = PAGES[poster.paper]
    // Tabloid is Letter's layout grown; it's taller, so the QR and type grow with its width.
    const scale = page.width / 8.5
    const inch = (n: number) => `${(n * scale).toFixed(3)}in`
    const pt = (n: number) => `${(n * scale).toFixed(2)}pt`
    const [width, height] = page.css
    const pink = poster.riso ? '#ff3d9a' : '#1a1519'
    const blue = poster.riso ? '#1a8cff' : '#8a8088'
    const venue = escape(poster.venueName)
    const audience = escape(poster.audienceName)
    // A bilingual headline ("Pay cover here · Paga el cover aquí") prints its second language as a smaller line.
    const [headlineMain, headlineAlt] = (poster.headline.trim() || copy.headline).split(' · ', 2)
    const headline = escape(headlineMain) + (headlineAlt ? `<span class="h1alt">${escape(headlineAlt)}</span>` : '')
    // Long headlines ("Paga el cover aquí") step down so they take two lines at most.
    // The lobby poster is read from across the line, so its code takes the room the taller page has.
    // Both languages take more lines, so the code gives up a little room for them.
    const qrSize = (poster.paper === 'tabloid' ? 4.6 : 3.2) * (bilingual ? 0.82 : 1)
    const headlineSize = headlineMain.length > 14 ? 50 : 64
    // The copy is the poster's own fixed text (its Spanish lines are .alt spans), so it isn't escaped.
    const steps = copy.steps.map((step, i) => `<li class="step step-${i}"><span class="n">${i + 1}</span><span>${step}</span></li>`)
    return `<!doctype html>
<html lang="${pageLang(poster.language)}">
<head>
<meta charset="utf-8">
<title>${escape(copy.title(poster.venueName))}</title>
<style>
  @font-face { font-family: 'Figtree'; src: url(${JSON.stringify(poster.fontUrl)}) format('woff2'); font-weight: 300 900; }
  @page { size: ${width} ${height}; margin: 0; }
  :root { --ink: #1a1519; --paper: #f6eff3; --pink: ${pink}; --blue: ${blue}; --muted: #5a4f57; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${width}; height: ${height}; background: var(--paper); color: var(--ink);
    font-family: 'Figtree', -apple-system, 'Helvetica Neue', Arial, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { position: relative; width: ${width}; height: ${height}; padding: ${inch(0.5)} ${inch(0.55)} ${inch(0.42)};
    overflow: hidden; display: flex; flex-direction: column; }
  /* The riso bands run under the header, wherever it ends, so a two-line headline never meets them. */
  .bands { position: relative; height: ${inch(0.5)}; margin: ${inch(0.08)} -1in 0; }
  .band { position: absolute; left: 0; right: 0; height: ${inch(0.16)}; transform: rotate(-3deg); }
  .band.pink { background: var(--pink); top: ${inch(0.1)}; }
  .band.ink { background: var(--ink); top: ${inch(0.15)}; }
  .band.blue { background: var(--blue); top: ${inch(0.2)}; }
  header { position: relative; z-index: 1; }
  h1 { font-weight: 900; font-size: ${pt(headlineSize)}; line-height: .9; letter-spacing: -0.03em; text-transform: uppercase;
    text-shadow: ${inch(-0.04)} ${inch(-0.02)} 0 var(--pink), ${inch(0.04)} ${inch(0.02)} 0 var(--blue); overflow-wrap: anywhere; }
  .kicker { margin-top: 0; font-size: ${pt(16)}; font-weight: 700; color: var(--muted); max-width: ${inch(6.8)}; line-height: 1.3; }
  .kicker b { color: var(--ink); font-weight: 900; }
  main { position: relative; z-index: 1; flex: 1; min-height: 0; padding-top: ${inch(0.3)}; display: flex; flex-direction: column; justify-content: center; }
  .card { background: #fff; border: ${inch(0.03)} solid var(--ink); border-radius: ${inch(0.32)};
    padding: ${inch(0.28)} ${inch(0.34)} ${inch(0.24)};
    box-shadow: ${inch(0.1)} ${inch(0.1)} 0 var(--pink), ${inch(0.18)} ${inch(0.18)} 0 var(--blue);
    display: flex; flex-direction: column; align-items: center; text-align: center; gap: ${inch(0.1)}; }
  .qr { width: ${inch(qrSize)}; height: ${inch(qrSize)}; display: block; }
  .eyebrow { font-weight: 900; font-size: ${pt(12.5)}; letter-spacing: .16em; text-transform: uppercase; color: var(--pink); }
  .card h2 { font-weight: 900; font-size: ${pt(27)}; line-height: 1.04; letter-spacing: -0.01em; }
  .card p { font-size: ${pt(12.5)}; line-height: 1.36; font-weight: 600; color: var(--muted); max-width: ${inch(5.8)}; }
  .card p strong { color: var(--ink); font-weight: 800; }
  .url { font-size: ${pt(13)}; font-weight: 900; }
  .steps { list-style: none; margin-top: ${inch(0.36)}; display: grid; grid-template-columns: 1fr 1fr 1.5fr; gap: ${inch(0.12)}; }
  .step { display: flex; align-items: center; gap: ${inch(0.1)}; background: #fff; border-radius: ${inch(0.16)};
    border-left: ${inch(0.09)} solid var(--pink); padding: ${inch(0.1)} ${inch(0.14)}; font-weight: 800;
    font-size: ${pt(14)}; line-height: 1.15; }
  .step-1 { border-color: var(--blue); }
  .step-2 { border-color: var(--ink); }
  .n { flex: none; width: ${inch(0.36)}; height: ${inch(0.36)}; border-radius: 50%; background: var(--ink); color: #fff;
    display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: ${pt(13)}; }
  footer { margin-top: ${inch(0.24)}; padding-top: ${inch(0.16)}; display: flex; justify-content: space-between; align-items: flex-end;
    gap: ${inch(0.3)}; font-size: ${pt(11)}; font-weight: 600; color: var(--muted); position: relative; z-index: 1; }
  footer .always { max-width: ${inch(4.6)}; color: var(--ink); font-weight: 700; }
  footer b { color: var(--ink); font-weight: 800; }
  .h1alt { display: block; margin-top: ${inch(0.06)}; font-size: .52em; letter-spacing: -0.01em; }
  .alt { display: block; margin-top: ${inch(0.03)}; font-style: italic; font-weight: 600; opacity: .82; }
  .bi .kicker { font-size: ${pt(13)}; }
  .bi .card { gap: ${inch(0.07)}; padding: ${inch(0.2)} ${inch(0.3)} ${inch(0.18)}; }
  .bi .card h2 { font-size: ${pt(21)}; }
  .bi .card p { font-size: ${pt(10.5)}; }
  .bi .steps { margin-top: ${inch(0.26)}; }
  .bi .step { font-size: ${pt(12)}; }
  .bi footer { font-size: ${pt(10)}; }
</style>
</head>
<body>
<div class="page${bilingual ? ' bi' : ''}">
  <header>
    <h1>${headline}</h1>
    <div class="bands"><div class="band pink"></div><div class="band ink"></div><div class="band blue"></div></div>
    <div class="kicker">${copy.kicker(venue)}</div>
  </header>
  <main>
    <section class="card">
      ${qrSvg(poster.link)}
      <div class="eyebrow">${escape(copy.eyebrow)}</div>
      <h2>${copy.cardTitle}</h2>
      <p>${copy.cardBody(audience)}</p>
      <div class="url">${escape(printedDomain(poster.link))}/cover</div>
    </section>
    <ul class="steps">${steps.join('')}</ul>
  </main>
  <footer>
    <div class="always">${copy.always}</div>
    <div><b>${venue}</b> · ${audience}</div>
  </footer>
</div>
</body>
</html>
`
}
