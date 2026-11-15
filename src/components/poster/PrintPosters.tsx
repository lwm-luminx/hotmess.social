// A venue's print posters, the same ones the AudienceKit console prints (src/lib/poster/kit, synced from the API):
// the cover poster, whose QR sells tonight's cover at the door (anyone signed in can print it: the code is the venue's
// own and the money goes to the venue), and the safety poster, whose QR tells the venue's staff someone feels unsafe
// (only the venue's managers can print it: printSafetyPoster gives them its code). Both download as PDFs; when the
// site can't make one, the browser prints the page instead.
import { useEffect, useMemo, useState } from 'react';
import { api, APIError, session } from '../../lib/api';
import { reportError } from '../../lib/errorReporting';
import { POSTER_LANGUAGES, type PosterLanguage } from '../../lib/poster/kit/Poster/i18n';
import { COVER_PAPER_SIZES, coverCopy, coverPosterHtml, coverPosterLink, type CoverPaper } from '../../lib/poster/kit/Poster/cover';
import {
  CODE_WORDS, isDefaultSafetyHeadline, SAFETY_PAPER_SIZES, safetyHeadline, safetyPosterHtml, type CodeWord, type SafetyPaper,
} from '../../lib/poster/kit/Poster/safety';
import type { PosterListing } from '../../lib/poster/listing';

const WEB = 'https://hotmess.social';
const AUDIENCE = 'Hot Mess';
const fontUrl = () => new URL('/fonts/Figtree-Variable.woff2', window.location.href).href;
const fileName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'venue';

type Kind = 'cover' | 'safety';
type PdfRequest = { kind: Kind; venueName: string; link: string; paper: string; language: PosterLanguage } & Record<string, string>;

/**
 * Downloads the poster as a PDF made by the site (src/pages/poster/pdf.ts), which prints the same in every browser.
 * Returns false when the site couldn't make it, so the caller can print the page instead.
 */
async function downloadPdf(request: PdfRequest): Promise<boolean> {
  try {
    const response = await fetch('/poster/pdf', { method: 'POST', body: JSON.stringify(request),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.token}` } });
    if (!response.ok) return false;
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? 'poster.pdf';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

/** Prints the poster in its own window, so the print dialog sees only it at its paper size; blocked, it downloads. */
function printHtml(html: string, file: string) {
  const win = window.open('', '_blank');
  if (!win) {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url; a.download = file; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  win.document.open(); win.document.write(html); win.document.close();
  win.addEventListener('load', () => { void win.document.fonts.ready.then(() => win.print()); });
}

export default function PrintPosters({ venue, language: startLanguage, onSignedOut }: {
  venue: PosterListing; language: PosterLanguage; onSignedOut: () => void;
}) {
  const [kind, setKind] = useState<Kind>('cover');
  const [language, setLanguage] = useState<PosterLanguage>(startLanguage);
  useEffect(() => setLanguage(startLanguage), [startLanguage]);
  return (
    <section className="print-posters" aria-labelledby="print-h">
      <h2 id="print-h">Print posters for {venue.name}</h2>
      <p className="hint">The same posters venues print from AudienceKit, ready for the lobby and the bathroom wall.</p>
      <div className="seg" role="radiogroup" aria-label="Poster">
        <label><input type="radio" name="print-kind" checked={kind === 'cover'} onChange={() => setKind('cover')} /><b>Cover poster</b><small>Its code sells tonight's cover</small></label>
        <label><input type="radio" name="print-kind" checked={kind === 'safety'} onChange={() => setKind('safety')} /><b>Safety poster</b><small>Its code tells the staff on shift. Venue managers only</small></label>
      </div>
      <label className="field">Language
        <select value={language} onChange={(e) => setLanguage(e.target.value as PosterLanguage)}>
          {POSTER_LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </label>
      {kind === 'cover'
        ? <CoverPoster venue={venue} language={language} onSignedOut={onSignedOut} />
        : <SafetyPoster venue={venue} language={language} onSignedOut={onSignedOut} />}
    </section>
  );
}

function CoverPoster({ venue, language, onSignedOut }: { venue: PosterListing; language: PosterLanguage; onSignedOut: () => void }) {
  const [paper, setPaper] = useState<CoverPaper>('letter');
  const [headline, setHeadline] = useState('');
  const [cover, setCover] = useState<{ cents: number | null; payable: boolean } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    api.posterCover(venue.id).then((c) => { if (current) setCover(c); }, (e) => {
      if (!current) return;
      if (e instanceof APIError && e.signedOut) return onSignedOut();
      if (!(e instanceof APIError) || e.reportable) reportError(e);
      setCover(null);
    });
    return () => { current = false; };
  }, [venue.id]);
  const link = coverPosterLink(WEB, venue.id);
  const html = useMemo(() => link && coverPosterHtml({
    audienceName: AUDIENCE, venueName: venue.name, link, headline, paper, language, riso: true, fontUrl: fontUrl(),
  }), [link, venue.name, headline, paper, language]);

  return (
    <div className="print-poster">
      <div className="fields">
        <label className="field">Size
          <select value={paper} onChange={(e) => setPaper(e.target.value as CoverPaper)}>
            {COVER_PAPER_SIZES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
        <label className="field">Headline
          <input value={headline} maxLength={24} placeholder={coverCopy(language).headline} onChange={(e) => setHeadline(e.target.value)} />
        </label>
        {cover && !cover.payable && <p className="hint warn">{venue.name} can't take cover in Hot Mess yet, so people who scan see the price to pay at the door. The venue connects payments in AudienceKit.</p>}
        {cover === null && <p className="hint warn">{venue.name} has no cover set up in Hot Mess, so the poster shows the next night with one, if any.</p>}
        {cover && cover.cents == null && <p className="hint">No usual cover is set, so it sells only nights with a cover set for the night or an event.</p>}
        {link && <p className="hint">The code opens <b>{link.replace(/^https?:\/\//, '')}</b>: the App Clip with Apple Pay on an iPhone, Hot Mess if it's installed, or the web. It never changes, and always sells the night that's on.</p>}
        <button type="button" className="button" disabled={!html || busy} onClick={async () => {
          if (!html || !link) return;
          setBusy(true);
          if (!await downloadPdf({ kind: 'cover', venueName: venue.name, link, paper, language, headline })) {
            printHtml(html, `${fileName(venue.name)}-cover-poster.html`);
          }
          setBusy(false);
        }}>{busy ? 'Making the PDF…' : 'Download the cover poster (PDF)'}</button>
      </div>
      {html && <div className={`preview ${paper}`}><iframe title={`Cover poster preview for ${venue.name}`} srcDoc={html} tabIndex={-1} /></div>}
    </div>
  );
}

function SafetyPoster({ venue, language, onSignedOut }: { venue: PosterListing; language: PosterLanguage; onSignedOut: () => void }) {
  const [paper, setPaper] = useState<SafetyPaper>('letter');
  const [codeWord, setCodeWord] = useState<CodeWord>('angel_shot');
  const [headline, setHeadline] = useState(safetyHeadline(language));
  const [emergency, setEmergency] = useState('911');
  const [state, setState] = useState<'idle' | 'busy' | 'pdf' | 'forbidden' | 'failed'>('idle');
  // A headline nobody changed follows the language; one they wrote stays.
  useEffect(() => setHeadline((h) => (isDefaultSafetyHeadline(h) ? safetyHeadline(language) : h)), [language]);

  const options = (link: string | null) => ({
    audienceName: AUDIENCE, venueName: venue.name, link, sampleLink: `${WEB}/help`, headline, codeWord,
    emergencyNumber: emergency, paper, riso: true, language, fontUrl: fontUrl(),
  });
  // The preview shows a sample code; the real one is only fetched (and made, the first time) to print.
  const preview = useMemo(() => safetyPosterHtml(options(null)), [venue.name, headline, codeWord, emergency, paper, language]);

  const print = async () => {
    setState('busy');
    try {
      const link = await api.printSafetyPoster(venue.id);
      setState('pdf');
      const pdf = await downloadPdf({ kind: 'safety', venueName: venue.name, link, paper, language, headline, codeWord,
        emergencyNumber: emergency });
      if (!pdf) printHtml(safetyPosterHtml(options(link)), `${fileName(venue.name)}-safety-poster.html`);
      setState('idle');
    } catch (e) {
      if (e instanceof APIError && e.signedOut) return onSignedOut();
      if (e instanceof APIError && e.code === 'FORBIDDEN') return setState('forbidden');
      if (!(e instanceof APIError) || e.reportable) reportError(e);
      setState('failed');
    }
  };

  return (
    <div className="print-poster">
      <div className="fields">
        <label className="field">Size
          <select value={paper} onChange={(e) => setPaper(e.target.value as SafetyPaper)}>
            {SAFETY_PAPER_SIZES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
        <label className="field">Headline
          <input value={headline} maxLength={40} onChange={(e) => setHeadline(e.target.value)} />
        </label>
        <label className="field">Code word at the bar
          <select value={codeWord} onChange={(e) => setCodeWord(e.target.value as CodeWord)}>
            {CODE_WORDS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label className="field">Emergency number
          <input value={emergency} maxLength={12} onChange={(e) => setEmergency(e.target.value)} />
        </label>
        <p className="hint">Its code lets anyone at {venue.name}, with or without the app, tell the staff on shift they feel unsafe. Brief the staff on the code word before it goes up.</p>
        {state === 'forbidden' && <p className="hint warn">Only {venue.name}'s managers can print its safety poster. Ask them, or sign in with the account that manages the venue.</p>}
        {state === 'failed' && <p className="hint warn">Hot Mess couldn't get the poster's code just now. Try again in a moment.</p>}
        <button type="button" className="button" disabled={state === 'busy' || state === 'pdf'} onClick={print}>{
          state === 'busy' ? 'Getting its code…' : state === 'pdf' ? 'Making the PDF…' : 'Download the safety poster (PDF)'}</button>
      </div>
      <div className={`preview ${paper}`}><iframe title={`Safety poster preview for ${venue.name}`} srcDoc={preview} tabIndex={-1} /></div>
    </div>
  );
}
