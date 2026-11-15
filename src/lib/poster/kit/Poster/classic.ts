import { qrPath } from '../Devices/qr'
import { pageLang, posterDate, posterStrings, posterWhen, type PosterLanguage } from './i18n'
import { subjectPath, tipLine, type PosterSubject } from './subject'

export type PaperSize = 'letter' | 'a4'

export const PAPER_SIZES: Array<{ value: PaperSize; label: string }> = [
    { value: 'letter', label: 'US Letter (8.5 × 11 in)' },
    { value: 'a4', label: 'A4 (210 × 297 mm)' },
]

/** How long a poster's link opens the record: printed posters outlive app shares, so a year unless picked otherwise. */
export type PosterLifetime = 'SIX_MONTHS' | 'YEAR' | 'TWO_YEARS'

export const POSTER_LIFETIMES: Array<{ value: PosterLifetime; label: string }> = [
    { value: 'SIX_MONTHS', label: '6 months' },
    { value: 'YEAR', label: '1 year' },
    { value: 'TWO_YEARS', label: '2 years' },
]

/** A link's expiry as people read it ("Oct 20, 2027"). */
export function expiryDate(expiresAt: string): string {
    return new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export interface ClassicPoster {
    audienceName: string
    subject: PosterSubject
    /** The share link the QR opens: the audience's app when installed, its web page otherwise. */
    link: string
    /** When the signed link stops opening the record (it shows "This link has expired" after), printed small. */
    expiresAt?: string | null
    headline: string
    note: string
    paper: PaperSize
    /** Hot Mess's riso pink and blue; every other audience prints in ink only. */
    riso: boolean
    /** An absolute URL for Figtree, so the poster's own window can load it. */
    fontUrl: string
    /** The language the poster prints in; English when left out. */
    language?: PosterLanguage
}

/**
 * A record's share link (`https://hotmess.social/venues/<uuid>`), unsigned: what shows until the signed one arrives.
 * Hot Mess opens it on the record when installed (universal links, Android App Links), the web page shows it
 * otherwise, and an App Clip can claim it later without a reprint.
 */
export function shareLink(webUrl: string, path: string): string {
    return `${webUrl.replace(/\/+$/, '')}${path}`
}

export const venueShareLink = (webUrl: string, venueId: string) => shareLink(webUrl, subjectPath({ kind: 'venue', id: venueId }))

/** What the poster prints under the QR: the audience's domain, since the record's id is too long to type. */
export function printedDomain(link: string): string {
    try {
        return new URL(link).host
    } catch {
        return link
    }
}

/** The headline a poster starts with; staff can change it. */
export function defaultHeadline(subject: Pick<PosterSubject, 'kind' | 'name'>, audienceName: string, language: PosterLanguage = 'en'): string {
    const t = posterStrings(language)
    return subject.kind === 'person' ? t.seeOn(subject.name, audienceName) : t.findOn(subject.name, audienceName)
}

const escape = (value: string) => value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The QR as an SVG, black on white with its quiet zone, so any camera reads it. */
export function qrSvg(value: string, className = 'qr'): string {
    const { size, path } = qrPath(value)
    return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`
        + `<rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`
}

/** What each kind of poster says the app opens on, under "Have the app?". */
function opensOn(subject: PosterSubject, name: string, language: PosterLanguage): string {
    return posterStrings(language).opensOn[subject.kind](name)
}

/** The performer poster's "Coming up" rows and tip line; nothing for venues and events. */
function performerBlock(subject: PosterSubject, language: PosterLanguage): string {
    if (subject.kind !== 'person') return ''
    const t = posterStrings(language)
    const gigs = (subject.gigs ?? []).slice(0, 3)
    const rows = gigs.map((gig) => `<li><b>${escape(gig.name)}</b><span>${escape([gig.when, gig.where].filter(Boolean).join(' · '))}</span></li>`)
    const tips = tipLine(subject, t.tips)
    if (!rows.length && !tips) return ''
    return `<section class="gigs">
    ${rows.length ? `<div class="eyebrow">${t.comingUp}</div><ul>${rows.join('')}</ul>` : ''}
    ${tips ? `<div class="tip">${escape(tips)}</div>` : ''}
  </section>`
}

/**
 * When the subject is on, in the poster's language: English keeps the page's own text; another language formats the
 * event's start again when it has one ("jue, 21 de nov, 9 p.m."), and keeps the page's text otherwise.
 */
export function subjectWhen(subject: Pick<PosterSubject, 'when' | 'startAt'>, language: PosterLanguage): string | null {
    if (language !== 'es' || !subject.startAt) return subject.when
    return posterWhen(subject.startAt.at, subject.startAt.timeZone, language) ?? subject.when
}

/** The footer's left side: a venue's address, an event's when and where, a performer's home venue. */
function footerLeft(subject: PosterSubject, name: string, language: PosterLanguage): string {
    const parts = subject.kind === 'event' ? [subjectWhen(subject, language), subject.where] : [subject.where]
    const text = parts.filter(Boolean).join(' · ')
    return text ? escape(text) : `<b>${name}</b>`
}

/**
 * The printable "find us" poster as one HTML document: the preview's iframe shows it and Print opens it in its own
 * window, so what staff see is what prints. One QR that opens the venue, event or performer in the audience's app,
 * and the same riso look as the Hot Mess download poster (hotmess.social/poster).
 */
export function classicPosterHtml(poster: ClassicPoster): string {
    const { subject } = poster
    const [width, height] = poster.paper === 'a4' ? ['210mm', '297mm'] : ['8.5in', '11in']
    const pink = poster.riso ? '#ff3d9a' : '#1a1519'
    const blue = poster.riso ? '#1a8cff' : '#8a8088'
    const audience = escape(poster.audienceName)
    const name = escape(subject.name)
    const note = poster.note.trim()
    const performer = subject.kind === 'person'
    const language = poster.language ?? 'en'
    const t = posterStrings(language)
    return `<!doctype html>
<html lang="${pageLang(language)}">
<head>
<meta charset="utf-8">
<title>${t.posterTitle(name)}</title>
<style>
  @font-face { font-family: 'Figtree'; src: url(${JSON.stringify(poster.fontUrl)}) format('woff2'); font-weight: 300 900; }
  @page { size: ${width} ${height}; margin: 0; }
  :root { --ink: #1a1519; --paper: #f6eff3; --pink: ${pink}; --blue: ${blue}; --muted: #5a4f57; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${width}; height: ${height}; background: var(--paper); color: var(--ink);
    font-family: 'Figtree', -apple-system, 'Helvetica Neue', Arial, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { position: relative; width: ${width}; height: ${height}; padding: 0.55in 0.6in 0.45in; overflow: hidden;
    display: flex; flex-direction: column; }
  .band { position: absolute; left: -1in; right: -1in; height: 0.2in; transform: rotate(-4deg); }
  .band.pink { background: var(--pink); top: ${performer ? '2.15in' : '2.5in'}; }
  .band.ink { background: var(--ink); top: ${performer ? '2.215in' : '2.565in'}; }
  .band.blue { background: var(--blue); top: ${performer ? '2.28in' : '2.63in'}; }
  header { height: ${performer ? '1.55in' : '1.9in'}; display: flex; flex-direction: column; justify-content: center; }
  .wordmark { font-weight: 900; font-size: 60pt; line-height: .9; letter-spacing: -0.03em; text-transform: uppercase;
    text-shadow: -4px -2px 0 var(--pink), 4px 2px 0 var(--blue); overflow-wrap: anywhere; }
  .kicker { margin-top: 0.14in; font-size: 17pt; font-weight: 700; color: var(--muted); }
  .kicker b { color: var(--ink); font-weight: 900; }
  .card { position: relative; z-index: 1; margin-top: ${performer ? '0.6in' : '0.75in'}; background: #fff; border: 3px solid var(--ink);
    border-radius: 0.3in; padding: ${performer ? '0.26in 0.36in 0.24in' : '0.34in 0.36in 0.32in'}; box-shadow: 0.11in 0.11in 0 var(--pink), 0.2in 0.2in 0 var(--blue);
    display: flex; flex-direction: column; align-items: center; text-align: center; }
  .eyebrow { font-weight: 900; font-size: 13pt; letter-spacing: .16em; text-transform: uppercase; color: var(--pink); }
  h1 { font-weight: 900; font-size: ${performer ? '28pt' : '32pt'}; line-height: 1.02; letter-spacing: -0.015em; margin-top: 0.06in; overflow-wrap: anywhere; }
  .qr { width: ${performer ? '2.4in' : '3.1in'}; height: ${performer ? '2.4in' : '3.1in'}; margin-top: 0.22in; display: block; }
  .url { margin-top: 0.14in; font-size: 17pt; font-weight: 900; }
  .note { margin-top: 0.1in; font-size: 13pt; font-weight: 600; color: var(--muted); }
  .gigs { margin-top: 0.3in; position: relative; z-index: 1; }
  .gigs .eyebrow { font-size: 11pt; }
  .gigs ul { list-style: none; margin-top: 0.06in; }
  .gigs li { display: flex; justify-content: space-between; gap: 0.2in; padding: 0.06in 0; border-top: 1.5px solid var(--ink);
    font-size: 12.5pt; font-weight: 600; color: var(--muted); }
  .gigs li b { color: var(--ink); font-weight: 900; }
  .gigs li span { text-align: right; white-space: nowrap; }
  .tip { margin-top: 0.12in; font-size: 12.5pt; font-weight: 800; color: var(--ink); }
  .how { margin-top: ${performer ? '0.2in' : '0.34in'}; display: grid; grid-template-columns: 1fr 1fr; gap: 0.3in; position: relative; z-index: 1; }
  .how div { border-left: 0.09in solid var(--pink); padding-left: 0.18in; }
  .how div + div { border-color: var(--blue); }
  .how h2 { font-weight: 900; font-size: 16pt; line-height: 1.05; }
  .how p { margin-top: 0.06in; font-size: 11.5pt; line-height: 1.32; font-weight: 500; color: var(--muted); }
  .how p strong { color: var(--ink); font-weight: 800; }
  footer { margin-top: auto; padding-top: 0.15in; display: flex; justify-content: space-between; align-items: flex-end; gap: 0.3in;
    font-size: 11pt; font-weight: 600; color: var(--muted); }
  footer b { color: var(--ink); font-weight: 800; }
  .alt { display: block; margin-top: 0.04in; font-style: italic; opacity: .8; }
</style>
</head>
<body>
<div class="page">
  <div class="band pink"></div><div class="band ink"></div><div class="band blue"></div>
  <header>
    <div class="wordmark">${audience}</div>
    <div class="kicker">${t.isOn(name, audience)}</div>
  </header>
  <section class="card">
    <div class="eyebrow">${t.scanWithCamera}</div>
    <h1>${escape(poster.headline.trim() || subject.name)}</h1>
    ${qrSvg(poster.link)}
    <div class="url">${escape(printedDomain(poster.link))}</div>
    ${note ? `<div class="note">${escape(note)}</div>` : ''}
  </section>
  ${performerBlock(subject, language)}
  <section class="how">
    <div>
      <h2>${t.haveApp}</h2>
      <p>${opensOn(subject, name, language)}</p>
    </div>
    <div>
      <h2>${t.noAppYet}</h2>
      <p>${t.noAppBody(name, audience)}</p>
    </div>
  </section>
  <footer>
    <div>${footerLeft(subject, name, language)}</div>
    <div>${poster.expiresAt ? `${t.codeWorksUntil(escape(posterDate(poster.expiresAt, language)))} · ` : ''}<b>${escape(printedDomain(poster.link))}</b></div>
  </footer>
</div>
</body>
</html>
`
}
