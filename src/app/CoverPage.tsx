// A venue's lobby cover poster, https://hotmess.social/cover/<code>: pay tonight's cover without the app, then show the
// pass at the door. On an iPhone the App Clip claims the same link and pays with Apple Pay; this page is for everyone
// else (Android, desktop, or an iPhone that opens it in Safari). It pays through the App Clip's guest checkout with
// Stripe's Payment Element on the venue's own account (src/lib/coverPosterApi.ts). The night is whatever is on when
// it's scanned; when nothing is on tonight it shows the next night, which is sold at the door or in the app.
import { useEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import {
  clampToScale, coverPrice, estimateTotal, money, nightLabel, offer, stepScale, pageLanguage, passCode, timeLabel, PASS_WINDOW,
  type CoverJSON, type CoverPosterJSON, type GuestAdmissionJSON, type Language, type NightJSON,
} from '../lib/coverPoster';
import { coverPoster, loadStripe, saveCover, savedCover, type StripeJS } from '../lib/coverPosterApi';
import { downloadUrl } from '../lib/download';

const COPY = {
  en: {
    loading: 'Loading…', missing: 'This poster’s code isn’t in use. Ask at the door.', failed: 'We couldn’t load tonight’s cover just now.',
    retry: 'Try again', tonight: 'Tonight', next: (day: string) => `Next night: ${day}`, nothingTonight: 'Nothing’s on tonight.',
    from: (time: string) => `Cover from ${time}`, cover: 'Cover', fee: 'Fees', total: 'Total', each: 'each',
    howMany: 'How many?', choose: 'Choose one', pay: (total: string) => `Pay ${total}`, continue: (total: string) => `Continue to pay ${total}`,
    paying: 'Paying…', starting: 'Starting…', noAccount: 'No app or account needed. Your card goes straight to the venue through Stripe.',
    door: (price: string) => `Cover is ${price}, paid at the door.`, inApp: (price: string) => `Cover is ${price}. Pay it in the Hot Mess app, or at the door.`,
    tickets: 'Tickets are sold for tonight', getTickets: 'Get tickets', free: 'No cover tonight. Come on in.',
    nothing: 'Nothing’s on in the next two weeks. Check back soon.', nextSold: 'Scan this code again on the night to pay, or pay at the door.',
    passTitle: 'Your cover pass', passHint: 'Show this at the door. The code changes every 30 seconds, so a screenshot won’t work.',
    admits: (n: number) => `Admits ${n}`, checkedIn: 'Checked in', pending: 'Waiting for the payment to go through…',
    keep: 'Keep this page open, or get Hot Mess to keep your pass and see what’s on.', getApp: 'Get Hot Mess',
    seeVenue: 'See the venue', failedPay: 'That didn’t go through. Check your card and try again.',
    sliding: (range: string) => `${range}, pay what you can`, howMuch: 'How much each?',
    suggested: (price: string) => `Suggested ${price}`, less: 'Pay less', more: 'Pay more',
  },
  es: {
    loading: 'Cargando…', missing: 'El código de este póster ya no se usa. Pregunta en la puerta.', failed: 'No pudimos cargar el cover de esta noche.',
    retry: 'Intentar de nuevo', tonight: 'Esta noche', next: (day: string) => `Próxima noche: ${day}`, nothingTonight: 'Hoy no hay nada.',
    from: (time: string) => `Cover desde las ${time}`, cover: 'Cover', fee: 'Cargos', total: 'Total', each: 'c/u',
    howMany: '¿Cuántos?', choose: 'Elige uno', pay: (total: string) => `Pagar ${total}`, continue: (total: string) => `Continuar para pagar ${total}`,
    paying: 'Pagando…', starting: 'Un momento…', noAccount: 'No necesitas la app ni una cuenta. Tu tarjeta va directo al lugar a través de Stripe.',
    door: (price: string) => `El cover es de ${price} y se paga en la puerta.`, inApp: (price: string) => `El cover es de ${price}. Págalo en la app de Hot Mess o en la puerta.`,
    tickets: 'Hoy se venden boletos', getTickets: 'Comprar boletos', free: 'Hoy no hay cover. Pásale.',
    nothing: 'No hay nada en las próximas dos semanas. Vuelve pronto.', nextSold: 'Escanea este código esa noche para pagar, o paga en la puerta.',
    passTitle: 'Tu pase de cover', passHint: 'Muéstralo en la puerta. El código cambia cada 30 segundos, así que una captura no sirve.',
    admits: (n: number) => n === 1 ? 'Entra 1 persona' : `Entran ${n} personas`, checkedIn: 'Ya entraste', pending: 'Esperando a que se confirme el pago…',
    keep: 'Deja esta página abierta, o descarga Hot Mess para guardar tu pase y ver qué hay.', getApp: 'Descargar Hot Mess',
    seeVenue: 'Ver el lugar', failedPay: 'No se pudo. Revisa tu tarjeta e inténtalo de nuevo.',
    sliding: (range: string) => `${range}, paga lo que puedas`, howMuch: '¿Cuánto cada uno?',
    suggested: (price: string) => `Sugerido ${price}`, less: 'Pagar menos', more: 'Pagar más',
  },
} as const;

type Copy = (typeof COPY)[Language];

export function CoverPage({ code }: { code: string }) {
  const language = useMemo(() => pageLanguage(typeof navigator === 'undefined' ? undefined : navigator.languages), []);
  const t = COPY[language];
  const [poster, setPoster] = useState<CoverPosterJSON | null | 'missing' | 'failed'>(null);
  const [attempt, setAttempt] = useState(0);
  const [pass, setPass] = useState<GuestAdmissionJSON | null>(null);

  useEffect(() => {
    let current = true;
    setPoster(null);
    coverPoster.load(code).then(
      async (answer) => {
        if (!current) return;
        if (!answer) { setPoster('missing'); return; }
        setPoster(answer);
        // A pass this browser already paid (or a return from the bank's check) for tonight comes back.
        const saved = savedCover(code, answer.tonight.night);
        if (saved) {
          try {
            const admission = await coverPoster.confirm(saved.id, saved.token);
            // Paid, or back from the bank's check (Stripe adds payment_intent to the address): show the pass. A
            // checkout someone left before paying is forgotten, so the page offers to pay again.
            const returning = new URLSearchParams(window.location.search).has('payment_intent');
            if (admission.pass_secret || returning) { if (current) setPass(admission); } else saveCover(code, null);
          } catch (e) {
            if ((e as { status?: number }).status === 404) saveCover(code, null);
          }
        }
      },
      () => { if (current) setPoster('failed'); },
    );
    return () => { current = false; };
  }, [code, attempt]);

  if (poster === null) return <section className="card cover-page"><p className="muted">{t.loading}</p></section>;
  if (poster === 'missing' || poster === 'failed') {
    return <section className="card cover-page">
      <p>{poster === 'missing' ? t.missing : t.failed}</p>
      {poster === 'failed' ? <button className="button" type="button" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</button> : null}
    </section>;
  }
  if (pass) return <PassView pass={pass} t={t} language={language} code={code} onUpdate={setPass} />;

  const night = poster.next ?? poster.tonight;
  return <section className="card cover-page">
    <p className="cover-eyebrow">{poster.next ? `${t.nothingTonight} ${t.next(nightLabel(poster.next.night, language))}` : `${t.tonight} · ${nightLabel(night.night, language)}`}</p>
    <h1 className="cover-title">{poster.venue.name}</h1>
    {night.event?.name ? <p className="cover-event">{night.event.name}</p> : null}
    <Offer poster={poster} night={night} t={t} language={language} onPaid={(admission) => setPass(admission)} code={code} />
    <p className="muted small"><a href={poster.venue.path}>{t.seeVenue}</a></p>
  </section>;
}

function Offer({ poster, night, t, language, code, onPaid }: {
  poster: CoverPosterJSON; night: NightJSON; t: Copy; language: Language; code: string; onPaid: (a: GuestAdmissionJSON) => void;
}) {
  const what = offer(night);
  const from = what.kind === 'buy' || what.kind === 'app' || what.kind === 'door' ? timeLabel(what.cover.cover_from, language) : null;
  const fromLine = from ? <p className="muted">{t.from(from)}</p> : null;
  // A next night is never sold here: guest checkout sells tonight only.
  if (!night.tonight && what.kind !== 'nothing' && what.kind !== 'tickets') {
    const price = 'cover' in what ? coverPrice(what.cover, language) : null;
    const slides = 'cover' in what && what.cover.scale;
    return <>{price ? <p className="cover-price">{slides ? t.sliding(price) : price}</p> : <p>{t.free}</p>}{fromLine}<p className="muted">{t.nextSold}</p></>;
  }
  switch (what.kind) {
    case 'buy': return <>{fromLine}<Checkout venueId={poster.venue.id} cover={what.cover} t={t} language={language} code={code} onPaid={onPaid} /></>;
    case 'app': return <>{fromLine}<p>{t.inApp(shownPrice(what.cover, t, language))}</p><GetApp t={t} /></>;
    case 'door': return <>{fromLine}<p>{t.door(shownPrice(what.cover, t, language))}</p></>;
    case 'tickets': return <><p>{t.tickets}</p><a className="button" href={what.url} rel="noopener">{t.getTickets}</a></>;
    case 'free': return <p>{t.free}</p>;
    case 'nothing': return <p>{t.nothing}</p>;
  }
}

/** "$10", or "$5–$30, pay what you can" for a sliding scale. */
function shownPrice(cover: CoverJSON, t: Copy, language: Language): string {
  return cover.scale ? t.sliding(coverPrice(cover, language)) : coverPrice(cover, language);
}

function Checkout({ venueId, cover, t, language, code, onPaid }: {
  venueId: string; cover: CoverJSON; t: Copy; language: Language; code: string; onPaid: (a: GuestAdmissionJSON) => void;
}) {
  const max = Math.max(1, Math.min(cover.max_quantity ?? 10, 10));
  const [quantity, setQuantity] = useState(1);
  const [tier, setTier] = useState<string | null>(cover.tiers[0]?.id ?? null);
  const [stage, setStage] = useState<'choose' | 'starting' | 'card' | 'paying'>('choose');
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const mount = useRef<HTMLDivElement>(null);
  const payment = useRef<{ stripe: StripeJS; elements: ReturnType<StripeJS['elements']>; id: string; token: string } | null>(null);
  // A sliding scale (never with tiers): each cover's amount, starting at the suggested one.
  const scale = cover.tiers.length === 0 ? cover.scale ?? null : null;
  const [amount, setAmount] = useState(() => (scale ? clampToScale(scale.suggested_cents, scale) : cover.amount_cents));
  const price = cover.tiers.find((x) => x.id === tier) ?? cover;
  const each = scale ? { amount_cents: amount, total_cents: estimateTotal(cover, amount) } : price;
  const estimate = each.total_cents * quantity;

  const start = async () => {
    setStage('starting');
    setError(null);
    try {
      const [checkout, Stripe] = await Promise.all([coverPoster.start(venueId, quantity, tier, scale ? amount : null), loadStripe()]);
      saveCover(code, { id: checkout.admission.id, token: checkout.claim_token, night: checkout.admission.night });
      setTotal(checkout.admission.total_cents);
      if (!checkout.payment_intent_client_secret) {
        onPaid(await coverPoster.confirm(checkout.admission.id, checkout.claim_token));
        return;
      }
      const stripe = Stripe(checkout.publishable_key, { stripeAccount: checkout.stripe_account_id, locale: language });
      const elements = stripe.elements({ clientSecret: checkout.payment_intent_client_secret, locale: language,
        appearance: { theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'stripe' } });
      payment.current = { stripe, elements, id: checkout.admission.id, token: checkout.claim_token };
      setStage('card');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t.failedPay);
      setStage('choose');
    }
  };

  useEffect(() => {
    if (stage !== 'card' || !payment.current || !mount.current) return;
    const element = payment.current.elements.create('payment', { layout: 'tabs' });
    element.mount(mount.current);
    return () => element.destroy();
  }, [stage]);

  const pay = async () => {
    const current = payment.current;
    if (!current) return;
    setStage('paying');
    setError(null);
    const result = await current.stripe.confirmPayment({
      elements: current.elements, redirect: 'if_required', confirmParams: { return_url: window.location.href },
    });
    if (result.error) {
      setError(result.error.message ?? t.failedPay);
      setStage('card');
      return;
    }
    try {
      onPaid(await coverPoster.confirm(current.id, current.token));
    } catch {
      setError(t.failedPay);
      setStage('card');
    }
  };

  if (stage === 'card' || stage === 'paying') {
    return <div className="cover-checkout">
      <div ref={mount} className="cover-element" />
      {error ? <p className="cover-error" role="alert">{error}</p> : null}
      <button className="button cover-pay" type="button" onClick={pay} disabled={stage === 'paying'}>
        {stage === 'paying' ? t.paying : t.pay(money(total ?? estimate, cover.currency, language))}
      </button>
      <p className="muted small">{t.noAccount}</p>
    </div>;
  }
  return <div className="cover-checkout">
    {cover.tiers.length > 0 ? <fieldset className="cover-tiers">
      <legend>{t.choose}</legend>
      {cover.tiers.map((x) => <label key={x.id} className="cover-tier">
        <input type="radio" name="tier" checked={tier === x.id} onChange={() => setTier(x.id)} />
        <span><b>{x.name}</b>{x.description ? <span className="muted"> · {x.description}</span> : null}</span>
        <span>{money(x.amount_cents, cover.currency, language)}</span>
      </label>)}
    </fieldset> : scale ? <div className="cover-scale">
      <p className="cover-price">{t.sliding(coverPrice(cover, language))}</p>
      <div className="cover-quantity">
        <span>{t.howMuch}</span>
        <button type="button" className="button secondary" aria-label={t.less} disabled={amount <= scale.min_cents}
          onClick={() => setAmount((n) => stepScale(n, -1, scale))}>−</button>
        <output aria-live="polite">{money(amount, cover.currency, language)}</output>
        <button type="button" className="button secondary" aria-label={t.more} disabled={amount >= scale.max_cents}
          onClick={() => setAmount((n) => stepScale(n, 1, scale))}>+</button>
      </div>
      <p className="muted small">{t.suggested(money(scale.suggested_cents, cover.currency, language))}</p>
    </div> : <p className="cover-price">{money(cover.amount_cents, cover.currency, language)} <span className="muted small">{t.each}</span></p>}
    <div className="cover-quantity">
      <span>{t.howMany}</span>
      <button type="button" className="button secondary" aria-label="−" disabled={quantity <= 1} onClick={() => setQuantity((n) => n - 1)}>−</button>
      <output aria-live="polite">{quantity}</output>
      <button type="button" className="button secondary" aria-label="+" disabled={quantity >= max} onClick={() => setQuantity((n) => n + 1)}>+</button>
    </div>
    {each.total_cents !== each.amount_cents ? <p className="muted small">
      {t.cover} {money(each.amount_cents * quantity, cover.currency, language)} · {t.fee} {money((each.total_cents - each.amount_cents) * quantity, cover.currency, language)}
    </p> : null}
    {error ? <p className="cover-error" role="alert">{error}</p> : null}
    <button className="button cover-pay" type="button" onClick={start} disabled={stage === 'starting'}>
      {stage === 'starting' ? t.starting : t.continue(money(estimate, cover.currency, language))}
    </button>
    <p className="muted small">{t.noAccount}</p>
  </div>;
}

function PassView({ pass, t, language, code, onUpdate }: {
  pass: GuestAdmissionJSON; t: Copy; language: Language; code: string; onUpdate: (a: GuestAdmissionJSON) => void;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  // The rotating code, redrawn as each 30-second window starts.
  useEffect(() => {
    if (!pass.pass_secret) return;
    let current = true;
    const draw = async () => {
      const value = await passCode(pass.id, pass.pass_secret!);
      if (!current) return;
      const qr = qrcode(0, 'M');
      qr.addData(value);
      qr.make();
      setSvg(qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true }));
    };
    void draw();
    const timer = setInterval(draw, 1000 * Math.min(PASS_WINDOW, 5));
    return () => { current = false; clearInterval(timer); };
  }, [pass.id, pass.pass_secret]);
  // A payment still going through (a bank's check, say) is read again until it's paid.
  useEffect(() => {
    if (pass.pass_secret) return;
    const saved = savedCover(code, pass.night);
    if (!saved) return;
    const timer = setInterval(() => { coverPoster.confirm(saved.id, saved.token).then(onUpdate, () => {}); }, 4000);
    return () => clearInterval(timer);
  }, [pass.pass_secret, pass.night, code, onUpdate]);

  return <section className="card cover-page cover-pass">
    <p className="cover-eyebrow">{nightLabel(pass.night, language)}</p>
    <h1 className="cover-title">{pass.venue.name}</h1>
    <h2>{t.passTitle}</h2>
    {pass.checked_in_at ? <p className="cover-done">{t.checkedIn}</p> : null}
    {pass.pass_secret
      ? <div className="cover-qr" role="img" aria-label={t.passTitle} dangerouslySetInnerHTML={{ __html: svg ?? '' }} />
      : <p className="muted">{t.pending}</p>}
    <p><b>{t.admits(pass.quantity)}</b>{pass.tier ? ` · ${pass.tier}` : ''} · {money(pass.total_cents, pass.currency, language)}</p>
    <p className="muted small">{t.passHint}</p>
    <p className="muted small">{t.keep}</p>
    <GetApp t={t} />
  </section>;
}

function GetApp({ t }: { t: Copy }) {
  const store = typeof navigator === 'undefined' ? null : downloadUrl(navigator.userAgent, navigator.maxTouchPoints);
  return <a className="button secondary" href={store ?? '/download'} rel="noopener">{t.getApp}</a>;
}
