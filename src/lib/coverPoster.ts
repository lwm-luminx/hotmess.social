// A venue's lobby cover poster, https://hotmess.social/cover/<code> (audience_kit_api doc/DIGITAL_COVER_CHARGE.md,
// "Cover poster"): the night the poster sells right now, its price, and the rotating pass the door scans once it's
// paid. Pure, so `npm test` checks it; the calls are in coverPosterApi.ts and the page in src/app/CoverPage.tsx.

/** A night's cover, as the App Clip sees it (`GET /v1/share?view=clip`'s `clip.cover`). */
export interface CoverJSON {
  night: string; event_id: string | null; amount_cents: number; fee_cents: number; total_cents: number;
  currency: string; cover_from: string | null; cover_until: string | null;
  tiers: Array<{ id: string; name: string; description: string | null; amount_cents: number; fee_cents: number; total_cents: number }>;
  payable: boolean; provider: string | null; guest_checkout: boolean; max_quantity: number | null;
  /** A sliding-scale cover's range; amount_cents is then the suggested amount. Null (or missing) for a fixed cover. */
  scale?: CoverScaleJSON | null;
}

export interface CoverScaleJSON { min_cents: number; max_cents: number; suggested_cents: number }

export interface NightJSON {
  night: string; tonight: boolean;
  event: { id: string | null; name: string | null; start_at: string | null; public: boolean; ticket_url?: string | null } | null;
  cover: CoverJSON | null;
}

/** `GET /v1/cover/:code`. */
export interface CoverPosterJSON {
  code: string; audience: { name: string }; venue: { id: string; name: string; path: string };
  tonight: NightJSON; next: NightJSON | null;
}

/** A guest's cover from `POST /v1/clip/covers` and its confirm. */
export interface GuestAdmissionJSON {
  id: string; status: string; night: string; quantity: number; tier: string | null; amount_cents: number;
  fee_cents: number; total_cents: number; currency: string; checked_in_at: string | null; pass_secret: string | null;
  venue: { id: string; name: string };
}

/** What the page offers for a night, in the order it decides. */
export type Offer =
  | { kind: 'buy'; cover: CoverJSON }          // pay here (Stripe guest checkout)
  | { kind: 'app'; cover: CoverJSON }          // payable, but Square: only the app takes it
  | { kind: 'door'; cover: CoverJSON }         // a price paid at the door
  | { kind: 'tickets'; url: string }           // tickets sold elsewhere, no cover
  | { kind: 'free' }                           // something on, no cover
  | { kind: 'nothing' };

export function offer(night: NightJSON | null): Offer {
  if (!night) return { kind: 'nothing' };
  const cover = night.cover;
  if (cover?.payable && cover.guest_checkout) return { kind: 'buy', cover };
  if (cover?.payable) return { kind: 'app', cover };
  if (cover) return { kind: 'door', cover };
  if (night.event?.ticket_url) return { kind: 'tickets', url: night.event.ticket_url };
  return night.event ? { kind: 'free' } : { kind: 'nothing' };
}

export type Language = 'en' | 'es';

/** Spanish for a browser that asks for it first (the Spanish poster's guests); English otherwise. */
export function pageLanguage(languages: readonly string[] | undefined): Language {
  return languages?.[0]?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function money(cents: number, currency = 'usd', language: Language = 'en'): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(language === 'es' ? 'es-US' : 'en-US', {
    style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

/** A cover's price: "$10", or a sliding scale's "$5–$30". */
export function coverPrice(cover: Pick<CoverJSON, 'amount_cents' | 'currency' | 'scale'>, language: Language = 'en'): string {
  const scale = cover.scale;
  if (!scale) return money(cover.amount_cents, cover.currency, language);
  return `${money(scale.min_cents, cover.currency, language)}–${money(scale.max_cents, cover.currency, language)}`;
}

/** Whole-dollar steps on a sliding scale. */
export const SCALE_STEP_CENTS = 100;

/** An amount kept within the scale. */
export function clampToScale(cents: number, scale: CoverScaleJSON): number {
  return Math.min(scale.max_cents, Math.max(scale.min_cents, Math.round(cents)));
}

/** One step up (+1) or down (−1) from an amount, landing on whole dollars and staying within the scale. */
export function stepScale(cents: number, direction: 1 | -1, scale: CoverScaleJSON): number {
  const next = direction > 0
    ? Math.floor(cents / SCALE_STEP_CENTS) * SCALE_STEP_CENTS + SCALE_STEP_CENTS
    : Math.ceil(cents / SCALE_STEP_CENTS) * SCALE_STEP_CENTS - SCALE_STEP_CENTS;
  return clampToScale(next, scale);
}

/** About what one cover costs with fees at a chosen amount, from the suggested amount's fees (the payment says exactly). */
export function estimateTotal(cover: Pick<CoverJSON, 'amount_cents' | 'total_cents'>, cents: number): number {
  return cents + (cover.total_cents - cover.amount_cents);
}

/** "Friday, Nov 20" for a night's ISO date, read as that calendar day. */
export function nightLabel(iso: string, language: Language = 'en'): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(language === 'es' ? 'es-MX' : 'en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "21:00" as "9 PM" (or "21:00 h" in Spanish). */
export function timeLabel(hhmm: string | null, language: Language = 'en'): string | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (language === 'es') return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} h`;
  const hour = ((h + 11) % 12) + 1;
  return `${hour}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

// The pass's QR code (audience_kit_api CoverPass): HMC1.<admission id>.<window>.<signature>, a new window every 30
// seconds, signed with the pass secret, so a screenshot stops scanning within a minute. Mirrors the apps.
export const PASS_WINDOW = 30;

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function passCode(id: string, secret: string, now = Date.now(), subtle: SubtleCrypto = crypto.subtle): Promise<string> {
  const window = Math.floor(now / 1000 / PASS_WINDOW);
  const key = await subtle.importKey('raw', Uint8Array.from(atob(secret), (c) => c.charCodeAt(0)),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${window}`)));
  return `HMC1.${id}.${window}.${base64url(signature).slice(0, 16)}`;
}
