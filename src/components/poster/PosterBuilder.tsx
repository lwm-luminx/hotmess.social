import { useEffect, useMemo, useRef, useState } from 'react';
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
  { value: 'event', label: 'A night or venue' },
  { value: 'none', label: 'No QR code' },
];

/** Options from the page's query string, so a poster can be linked to (/poster?slogan=…&format=…). */
function fromQuery(search: string): { options: PosterOptions; adult: boolean } {
  const q = new URLSearchParams(search);
  const base = PRESETS[0].options;
  const pick = <T extends string>(key: string, allowed: readonly string[], fallback: T): T => {
    const v = q.get(key);
    return v && allowed.includes(v) ? (v as T) : fallback;
  };
  const slogan = sloganById(q.get('slogan') ?? '') ?? sloganById(base.slogan)!;
  const adult = q.get('adult') === '1' || slogan.rating === 'adult_venue';
  return {
    adult,
    options: {
      slogan: slogan.id,
      format: pick<FormatKey>('format', Object.keys(FORMATS), base.format),
      style: pick<StyleKey>('look', Object.keys(LOOKS), base.style),
      art: pick<ArtKind | 'auto'>('art', ['auto', ...Object.keys(ART_LABELS)], 'auto'),
      qr: pick<QRMode>('qr', QR_MODES.map((m) => m.value), base.qr),
      event: { night: q.get('night') ?? '', venue: q.get('venue') ?? '', when: q.get('when') ?? '', link: q.get('link') ?? '' },
    },
  };
}

function toQuery(o: PosterOptions, adult: boolean): string {
  const q = new URLSearchParams({ slogan: o.slogan, format: o.format, look: o.style });
  if (o.art !== 'auto') q.set('art', o.art);
  if (o.qr !== 'download') q.set('qr', o.qr);
  if (o.qr === 'event') for (const [k, v] of Object.entries(o.event)) if (v) q.set(k, v);
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

export default function PosterBuilder() {
  const [options, setOptions] = useState<PosterOptions>(PRESETS[0].options);
  const [adult, setAdult] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const initial = fromQuery(window.location.search);
    setOptions(initial.options);
    setAdult(initial.adult);
    loadPosterFonts().then(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    const query = toQuery(options, adult);
    if (query !== window.location.search) window.history.replaceState(null, '', `${window.location.pathname}${query}`);
  }, [options, adult]);

  const slogan = sloganById(options.slogan) ?? SLOGANS[0];
  const available = useMemo(() => slogansFor(adult), [adult]);
  const update = (patch: Partial<PosterOptions>) => { setOptions((o) => ({ ...o, ...patch })); setStatus(''); };
  const setEvent = (key: keyof PosterOptions['event'], value: string) => update({ event: { ...options.event, [key]: value } });

  const onAdult = (on: boolean) => {
    setAdult(on);
    if (!on && slogan.rating === 'adult_venue') update({ slogan: PRESETS[0].options.slogan });
  };

  const download = async (kind: 'png' | 'pdf') => {
    setBusy(kind); setStatus(kind === 'pdf' ? 'Building the PDF…' : 'Rendering at full size…');
    try {
      const blob = kind === 'pdf' ? await exportPdf(options) : await exportPng(options);
      saveBlob(blob, posterFilename(options, kind));
      setStatus(`Downloaded ${posterFilename(options, kind)}.`);
    } catch {
      setStatus('That poster could not be saved. Try a PNG, or a smaller format.');
    } finally {
      setBusy(null);
    }
  };

  const themes = Object.keys(THEMES) as SloganTheme[];

  return (
    <div className="poster-builder">
      <section aria-labelledby="presets-h" className="presets">
        <h2 id="presets-h">Start from one of these</h2>
        <ul>
          {PRESETS.map((p) => (
            <li key={p.label}>
              <button type="button" onClick={() => { setOptions(p.options); setStatus(''); }} aria-label={`Start from ${p.label}`}>
                <PosterCanvas options={p.options} width={220} fontsReady={fontsReady} label={plainText(sloganById(p.options.slogan)!.text)} />
                <span><b>{p.label}</b>{FORMATS[p.options.format].label}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="builder-h" className="builder">
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
                  <input type="radio" name="qr" value={m.value} checked={options.qr === m.value} onChange={() => update({ qr: m.value })} />
                  {m.label}
                </label>
              ))}
            </div>
            {options.qr === 'event' && (
              <div className="event">
                <label>Night<input id="poster-night" value={options.event.night} placeholder="Leather Drag Night" onChange={(e) => setEvent('night', e.target.value)} /></label>
                <label>Venue<input id="poster-venue" value={options.event.venue} placeholder="Your bar, your city" onChange={(e) => setEvent('venue', e.target.value)} /></label>
                <label>When<input id="poster-when" value={options.event.when} placeholder="Thursdays · 9 PM" onChange={(e) => setEvent('when', e.target.value)} /></label>
                <label>Link<input id="poster-link" type="url" value={options.event.link} placeholder="Share link from the Hot Mess app" onChange={(e) => setEvent('link', e.target.value)} /></label>
                <p className="hint">Use the event or venue's share link from the app. Without one, the code opens the download page.</p>
              </div>
            )}
          </fieldset>
        </form>

        <div className="stage">
          <div className="frame">
            <PosterCanvas options={options} width={760} fontsReady={fontsReady} label={`Poster preview: ${plainText(slogan.text)}`} />
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
