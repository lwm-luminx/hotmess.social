import { useEffect, useMemo, useRef, useState } from 'react';
import { api, APIError } from '../../lib/api';
import { reportError } from '../../lib/errorReporting';
import { eventListing, listingFromQuery, posterLines, venueListing, type ListingKind, type ListingRef, type PosterListing } from '../../lib/poster/listing';
import SignedIn from '../../app/SignedIn';
import { ART_LABELS, SLOGANS, THEMES, plainText, sloganById, slogansFor, type ArtKind, type SloganTheme } from '../../lib/poster/slogans';
import {
  FORMATS, LOOKS, exportPdf, exportPng, exportSize, loadPosterFonts, posterFilename, renderPoster,
  type FormatKey, type PosterOptions, type QRMode, type StyleKey,
} from '../../lib/poster/render';

interface Preset { label: string; options: PosterOptions }

const NO_EVENT = { night: '', venue: '', when: '', link: '' };

const PRESETS: Preset[] = [
  { label: 'The download poster', options: { slogan: 'cheeky-every-sense', format: 'letter', style: 'riso', art: 'auto', qr: 'download', event: NO_EVENT } },
  { label: 'Leather Drag Night', options: { slogan: 'leather-drag', format: 'print', style: 'sticker', art: 'auto', qr: 'download', event: NO_EVENT } },
  { label: 'Harness or hymnal', options: { slogan: 'harness-hymnal', format: 'letter', style: 'glitter', art: 'auto', qr: 'download', event: NO_EVENT } },
  { label: 'Bring all of you', options: { slogan: 'bring-all-of-you', format: 'story', style: 'neon', art: 'auto', qr: 'none', event: NO_EVENT } },
  { label: 'For the bar TV', options: { slogan: 'beautiful-person', format: 'tv', style: 'neon', art: 'auto', qr: 'download', event: NO_EVENT } },
  { label: 'Swipe less', options: { slogan: 'swipe-less', format: 'post', style: 'sticker', art: 'mic', qr: 'none', event: NO_EVENT } },
];

const QR_MODES: { value: QRMode; label: string }[] = [
  { value: 'download', label: 'Download the app' },
  { value: 'event', label: 'Your venue or night' },
  { value: 'none', label: 'No QR code' },
];

/** What the poster is for: a venue, a night, or Hot Mess itself (the download poster). */
type Subject = ListingKind | 'app';

const SUBJECTS: { value: Subject; label: string; sub: string }[] = [
  { value: 'venue', label: 'Your venue', sub: 'Its code opens the venue in Hot Mess' },
  { value: 'event', label: 'A night', sub: 'Its code opens the night in Hot Mess' },
  { value: 'app', label: 'Hot Mess', sub: 'Its code downloads the app' },
];

/** Options from the page's query string, so a poster can be linked to (/poster?slogan=…&format=…&venue=<id>). A
 * venue or event in the address makes it the poster's, unless the address says another QR code. */
function fromQuery(search: string): { options: PosterOptions; adult: boolean; listing: ListingRef | null } {
  const q = new URLSearchParams(search);
  const base = PRESETS[0].options;
  const pick = <T extends string>(key: string, allowed: readonly string[], fallback: T): T => {
    const v = q.get(key);
    return v && allowed.includes(v) ? (v as T) : fallback;
  };
  const slogan = sloganById(q.get('slogan') ?? '') ?? sloganById(base.slogan)!;
  const adult = q.get('adult') === '1' || slogan.rating === 'adult_venue';
  const listing = listingFromQuery(q);
  return {
    adult,
    listing,
    options: {
      slogan: slogan.id,
      format: pick<FormatKey>('format', Object.keys(FORMATS), base.format),
      style: pick<StyleKey>('look', Object.keys(LOOKS), base.style),
      art: pick<ArtKind | 'auto'>('art', ['auto', ...Object.keys(ART_LABELS)], 'auto'),
      qr: pick<QRMode>('qr', QR_MODES.map((m) => m.value), listing ? 'event' : base.qr),
      event: NO_EVENT,
    },
  };
}

function toQuery(o: PosterOptions, adult: boolean, listing: ListingRef | null): string {
  const q = new URLSearchParams({ slogan: o.slogan, format: o.format, look: o.style });
  if (o.art !== 'auto') q.set('art', o.art);
  // A listing implies its QR code; an event-mode poster with none yet keeps qr=event.
  if (o.qr === 'event' && listing) q.set(listing.kind, listing.id);
  else if (o.qr !== 'download') q.set('qr', o.qr);
  if (adult) q.set('adult', '1');
  return `?${q}`;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function PosterCanvas({ options, width, fontsReady, label }: { options: PosterOptions; width: number; fontsReady: boolean; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    renderPoster(ref.current, options, Math.min(1, (width * ratio) / FORMATS[options.format].w));
  }, [options, width, fontsReady]);
  return <canvas ref={ref} role="img" aria-label={label} />;
}

/** The builder, for people signed in to Hot Mess; everyone else gets the sign-in card. Mount it client:only. */
export default function PosterStudio() {
  return <SignedIn lede="Sign in to make a poster. Find your venue or night in Hot Mess and the poster fills itself in.">
    {(signOut) => <PosterBuilder onSignedOut={signOut} />}
  </SignedIn>;
}

type Found = { venues: PosterListing[]; events: PosterListing[] };

/** Looks a venue or night up in Hot Mess by name; picking one makes it the poster's. */
function ListingSearch({ kind, id, onPick, onSignedOut }: {
  kind?: ListingKind; id: string; onPick: (listing: PosterListing) => void; onSignedOut: () => void;
}) {
  const [term, setTerm] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [state, setState] = useState<'idle' | 'searching' | 'failed'>('idle');

  useEffect(() => {
    const search = term.trim();
    if (search.length < 2) { setFound(null); setState('idle'); return; }
    let current = true;
    setState('searching');
    const timer = setTimeout(() => {
      api.posterSearch(search).then(
        (r) => {
          if (!current) return;
          setFound({ venues: r.venues.map(venueListing), events: r.events.map((e) => eventListing(e)) });
          setState('idle');
        },
        (e) => {
          if (!current) return;
          if (e instanceof APIError && e.signedOut) return onSignedOut();
          if (!(e instanceof APIError) || e.reportable) reportError(e);
          setState('failed');
        },
      );
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [term]);

  const group = (title: string, listings: PosterListing[]) => listings.length > 0 && (
    <div key={title}>
      <h3>{title}</h3>
      <ul>
        {listings.map((l) => (
          <li key={l.id}>
            <button type="button" onClick={() => onPick(l)}>
              <b>{l.name}</b><small>{[l.when, l.place].filter(Boolean).join(' · ')}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  const venues = kind === 'event' ? [] : found?.venues ?? [];
  const events = kind === 'venue' ? [] : found?.events ?? [];
  const none = found && venues.length + events.length === 0;
  const what = kind === 'venue' ? 'your venue' : kind === 'event' ? 'your night' : 'your venue or night';
  return (
    <div className="listing-search">
      <label htmlFor={id}>Find {what}</label>
      <input id={id} type="search" value={term} autoComplete="off"
        placeholder={kind === 'venue' ? 'Venue name' : kind === 'event' ? 'Event or venue name' : 'Venue or event name'}
        onChange={(e) => setTerm(e.target.value)} />
      <div className="results" aria-live="polite">
        {state === 'searching' && <p className="hint">Searching…</p>}
        {state === 'failed' && (
          <p className="hint">
            Hot Mess couldn't search just now. Try again in a moment, or{' '}
            <button type="button" className="link" onClick={onSignedOut}>sign in again</button>.
          </p>
        )}
        {state === 'idle' && none && <p className="hint">Nothing in Hot Mess matches "{term.trim()}". {kind === 'venue' ? 'Listed venues show here.' : kind === 'event' ? 'Upcoming events show here.' : 'Upcoming events and listed venues show here.'}</p>}
        {state === 'idle' && found && <>{group('Venues', venues)}{group('Upcoming events', events)}</>}
      </div>
    </div>
  );
}

/** The venue or night a poster is for, with a way to pick another. */
function Picked({ listing, onChange }: { listing: PosterListing; onChange: () => void }) {
  return (
    <div className="picked">
      <p><b>{listing.name}</b><small>{[listing.when, listing.place].filter(Boolean).join(' · ')}</small></p>
      <button type="button" className="button secondary" onClick={onChange}>Change</button>
    </div>
  );
}

/** Where the poster's QR code goes, in words. */
function qrHint(listing: PosterListing | null, link: string | null): string {
  if (!listing) return 'The poster takes its name, place and time from Hot Mess.';
  if (!link) return "Hot Mess couldn't make a link for this one, so the code opens the download page.";
  if (listing.kind === 'venue') return `The code is the venue's own link, ${link.replace(/^https:\/\//, '')}. It opens the venue in Hot Mess, or the app store on a phone without it, and it never expires.`;
  return 'The poster takes its name, place and time from Hot Mess, and the code opens the night in Hot Mess for a year.';
}

function PosterBuilder({ onSignedOut }: { onSignedOut: () => void }) {
  const [options, setOptions] = useState<PosterOptions>(PRESETS[0].options);
  const [adult, setAdult] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null);
  const [status, setStatus] = useState('');
  // The venue or event the poster is for, and the share link its QR code opens.
  const [listing, setListing] = useState<PosterListing | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState<ListingRef | null>(null);
  // Who the poster is for, which the first step asks.
  const [subject, setSubject] = useState<Subject>('app');
  const builderRef = useRef<HTMLElement>(null);

  // Fills the poster from the listing as Hot Mess has it now, with a share link that opens for a year.
  const choose = (ref: ListingRef) => {
    setLoading(ref); setStatus('');
    const fetched = ref.kind === 'venue'
      ? api.posterVenue(ref.id).then((r) => ({ listing: venueListing(r.venue), link: r.link }))
      : api.posterEvent(ref.id).then((r) => ({ listing: eventListing(r.event), link: r.link }));
    fetched.then(
      (r) => { setListing(r.listing); setLink(r.link); setLoading(null); },
      (e) => {
        setLoading(null);
        if (e instanceof APIError && e.signedOut) return onSignedOut();
        if (e instanceof APIError && e.notFound) return setStatus("That venue or event isn't in Hot Mess any more. Search for another.");
        if (!(e instanceof APIError) || e.reportable) reportError(e);
        setStatus("Hot Mess couldn't load that listing. Try again in a moment.");
      },
    );
  };

  useEffect(() => {
    const initial = fromQuery(window.location.search);
    setOptions(initial.options);
    setAdult(initial.adult);
    if (initial.listing && initial.options.qr === 'event') { setSubject(initial.listing.kind); choose(initial.listing); }
    else if (initial.options.qr === 'event') setSubject('venue');
    loadPosterFonts().then(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    // Until a linked listing has loaded, keep it in the address.
    const query = toQuery(options, adult, listing ?? loading);
    if (query !== window.location.search) window.history.replaceState(null, '', `${window.location.pathname}${query}`);
  }, [options, adult, listing, loading]);

  const poster = useMemo<PosterOptions>(() => ({ ...options, event: posterLines(listing, link) }), [options, listing, link]);

  const slogan = sloganById(options.slogan) ?? SLOGANS[0];
  const available = useMemo(() => slogansFor(adult), [adult]);
  const update = (patch: Partial<PosterOptions>) => { setOptions((o) => ({ ...o, ...patch })); setStatus(''); };

  const onAdult = (on: boolean) => {
    setAdult(on);
    if (!on && slogan.rating === 'adult_venue') update({ slogan: PRESETS[0].options.slogan });
  };

  const clearListing = () => { setListing(null); setLink(null); };

  const pickSubject = (next: Subject) => {
    setSubject(next); setStatus('');
    if (next === 'app') { clearListing(); setOptions((o) => ({ ...o, qr: o.qr === 'event' ? 'download' : o.qr })); return; }
    if (listing && listing.kind !== next) clearListing();
    setOptions((o) => ({ ...o, qr: 'event' }));
  };

  // Picking the venue or night in the first step fills the poster, then shows it.
  const pickListing = (picked: PosterListing) => {
    choose(picked);
    setOptions((o) => ({ ...o, qr: 'event' }));
    builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const onQRMode = (qr: QRMode) => {
    update({ qr });
    if (qr !== 'event') setSubject('app');
    else if (subject === 'app') setSubject(listing?.kind ?? 'venue');
  };

  const download = async (kind: 'png' | 'pdf') => {
    setBusy(kind); setStatus(kind === 'pdf' ? 'Building the PDF…' : 'Rendering at full size…');
    try {
      const blob = kind === 'pdf' ? await exportPdf(poster) : await exportPng(poster);
      saveBlob(blob, posterFilename(poster, kind));
      setStatus(`Downloaded ${posterFilename(poster, kind)}.`);
    } catch {
      setStatus('That poster could not be saved. Try a PNG, or a smaller format.');
    } finally {
      setBusy(null);
    }
  };

  const themes = Object.keys(THEMES) as SloganTheme[];

  return (
    <div className="poster-builder">
      <section aria-labelledby="subject-h" className="subject">
        <h2 id="subject-h">Who's the poster for?</h2>
        <div className="seg subjects" role="radiogroup" aria-labelledby="subject-h">
          {SUBJECTS.map((s) => (
            <label key={s.value}>
              <input type="radio" name="subject" value={s.value} checked={subject === s.value} onChange={() => pickSubject(s.value)} />
              <b>{s.label}</b><small>{s.sub}</small>
            </label>
          ))}
        </div>
        {subject !== 'app' && (
          <div className="event">
            {loading && <p className="hint">Loading the listing…</p>}
            {!loading && listing && listing.kind === subject && <Picked listing={listing} onChange={clearListing} />}
            {!loading && !(listing && listing.kind === subject) && (
              <ListingSearch key={subject} kind={subject} id="poster-subject-search" onPick={pickListing} onSignedOut={onSignedOut} />
            )}
            <p className="hint">{qrHint(listing && listing.kind === subject ? listing : null, link)}</p>
          </div>
        )}
      </section>

      <section aria-labelledby="presets-h" className="presets">
        <h2 id="presets-h">Start from one of these</h2>
        <ul>
          {PRESETS.map((p) => (
            <li key={p.label}>
              <button type="button" onClick={() => { setOptions((o) => ({ ...p.options, qr: o.qr === 'event' && p.options.qr !== 'none' ? 'event' : p.options.qr })); setStatus(''); }} aria-label={`Start from ${p.label}`}>
                <PosterCanvas options={p.options} width={220} fontsReady={fontsReady} label={plainText(sloganById(p.options.slogan)!.text)} />
                <span><b>{p.label}</b>{FORMATS[p.options.format].label}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="builder-h" className="builder" ref={builderRef}>
        <h2 id="builder-h">Make it yours</h2>
        <form className="controls" onSubmit={(e) => e.preventDefault()}>
          <fieldset>
            <legend>The line</legend>
            <label className="check">
              <input type="checkbox" checked={adult} onChange={(e) => onAdult(e.target.checked)} />
              <span>It's for an adult venue <small>Shows the lines meant for adult spaces only.</small></span>
            </label>
            <div className="slogans" role="radiogroup" aria-label="Slogan">
              {themes.map((theme) => {
                const lines = available.filter((s) => s.theme === theme);
                if (!lines.length) return null;
                return (
                  <div key={theme}>
                    <h3>{THEMES[theme]}</h3>
                    {lines.map((s) => (
                      <label key={s.id} className={s.id === options.slogan ? 'opt on' : 'opt'}>
                        <input type="radio" name="slogan" value={s.id} checked={s.id === options.slogan} onChange={() => update({ slogan: s.id })} />
                        <span>{plainText(s.text)}{s.rating === 'adult_venue' && <em className="tag">Adult venues</em>}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend>Size</legend>
            <div className="seg">
              {(Object.keys(FORMATS) as FormatKey[]).map((k) => (
                <label key={k}>
                  <input type="radio" name="format" value={k} checked={options.format === k} onChange={() => update({ format: k })} />
                  <b>{FORMATS[k].label}</b><small>{FORMATS[k].sub}</small>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Look</legend>
            <div className="looks">
              {(Object.keys(LOOKS) as StyleKey[]).map((k) => (
                <label key={k}>
                  <input type="radio" name="look" value={k} checked={options.style === k} onChange={() => update({ style: k })} />
                  <span className={`chip ${k}`} aria-hidden="true" />{LOOKS[k].label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend><label htmlFor="poster-art">Artwork</label></legend>
            <select id="poster-art" value={options.art} onChange={(e) => update({ art: e.target.value as ArtKind | 'auto' })}>
              <option value="auto">Match the line</option>
              {(Object.keys(ART_LABELS) as ArtKind[]).map((k) => <option key={k} value={k}>{ART_LABELS[k]}</option>)}
            </select>
          </fieldset>

          <fieldset>
            <legend>QR code</legend>
            <div className="qr-modes">
              {QR_MODES.map((m) => (
                <label key={m.value}>
                  <input type="radio" name="qr" value={m.value} checked={options.qr === m.value} onChange={() => onQRMode(m.value)} />
                  {m.label}
                </label>
              ))}
            </div>
            {options.qr === 'event' && (
              <div className="event">
                {loading && <p className="hint">Loading the listing…</p>}
                {!loading && listing && <Picked listing={listing} onChange={clearListing} />}
                {/* The search is in the first step, so there's one box to find it in. */}
                {!loading && !listing && <p className="hint">Find your venue or night under "Who's the poster for?" above.</p>}
                <p className="hint">{qrHint(listing, link)}</p>
              </div>
            )}
          </fieldset>
        </form>

        <div className="stage">
          <div className="frame">
            <PosterCanvas options={poster} width={760} fontsReady={fontsReady} label={`Poster preview: ${plainText(slogan.text)}`} />
          </div>
          <div className="bar">
            <p className="meta">{FORMATS[options.format].label} · {FORMATS[options.format].sub} · {exportSize(options.format)}</p>
            <div className="actions">
              <button type="button" className="button" disabled={busy !== null} onClick={() => download('pdf')}>Download PDF</button>
              <button type="button" className="button secondary" disabled={busy !== null} onClick={() => download('png')}>PNG image</button>
            </div>
          </div>
          <p className="status" role="status">{status}</p>
        </div>
      </section>
    </div>
  );
}
