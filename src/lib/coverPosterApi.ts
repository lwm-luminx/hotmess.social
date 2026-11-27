// The calls behind a venue's lobby cover poster page (src/app/CoverPage.tsx): what the poster sells right now
// (`GET /v1/cover/:code`), and the App Clip's guest checkout for paying it without an account (`POST /v1/clip/covers`,
// then confirm with the one-time claim token; audience_kit_api doc/APP_CLIP_CHECKOUT.md). The card is taken by Stripe's
// Payment Element on the venue's own connected account, so card numbers never touch Hot Mess. The paid pass stays in
// this browser's storage, keyed by the poster code, so a reload or a second scan that night shows it again.
import { apiError, website } from './api';
import type { CoverPosterJSON, GuestAdmissionJSON } from './coverPoster';

/** Runs an SDK call, failing with the site's APIError (whose status the page reads). */
async function call<T>(path: string, run: () => Promise<T>): Promise<T> {
  try { return await run(); } catch (e) { throw apiError(path, e); }
}

export interface GuestCheckout {
  admission: GuestAdmissionJSON; claim_token: string; provider: string;
  payment_intent_client_secret: string | null; publishable_key: string; stripe_account_id: string;
}

/** A guest cover this browser started or paid, with the token that reads it. */
export interface SavedCover { id: string; token: string; night: string }

const key = (code: string) => `hotmess.cover-poster.${code}`;

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function savedCover(code: string, night: string): SavedCover | null {
  try {
    const raw = storage()?.getItem(key(code));
    const saved = raw ? JSON.parse(raw) as Partial<SavedCover> : null;
    return saved?.id && saved.token && saved.night === night ? { id: saved.id, token: saved.token, night } : null;
  } catch {
    return null;
  }
}

export function saveCover(code: string, saved: SavedCover | null) {
  try {
    if (saved) storage()?.setItem(key(code), JSON.stringify(saved)); else storage()?.removeItem(key(code));
  } catch { /* private mode: the pass still shows until the page closes */ }
}

export const coverPoster = {
  /** The venue and its night; null for a code that names no venue. */
  load: (code: string): Promise<CoverPosterJSON | null> => call('cover', () => website.coverPoster<CoverPosterJSON>(code)),
  /** `amountCents` is what the guest chose to pay for each cover on a sliding scale; null pays the set price. */
  start: (venueId: string, quantity: number, tier: string | null, amountCents: number | null = null) =>
    call('clip/covers', () => website.startGuestCover<GuestCheckout>(venueId, quantity, tier, amountCents)),
  confirm: async (id: string, token: string) =>
    (await call('clip/covers/confirm', () => website.confirmGuestCover<{ admission: GuestAdmissionJSON }>(id, token))).admission,
};

// Stripe.js, loaded from js.stripe.com only when someone pays (Stripe requires it be loaded from there).
interface StripeElements { create(type: 'payment', options?: object): { mount(el: HTMLElement): void; destroy(): void } }
export interface StripeJS {
  elements(options: { clientSecret: string; appearance?: object; locale?: string }): StripeElements;
  confirmPayment(options: { elements: StripeElements; redirect: 'if_required'; confirmParams: { return_url: string } }):
    Promise<{ error?: { message?: string }; paymentIntent?: { status: string } }>;
}
type StripeFactory = (key: string, options: { stripeAccount: string; locale?: string }) => StripeJS;

let loading: Promise<StripeFactory> | null = null;

export function loadStripe(): Promise<StripeFactory> {
  const existing = (window as unknown as { Stripe?: StripeFactory }).Stripe;
  if (existing) return Promise.resolve(existing);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.onload = () => {
      const factory = (window as unknown as { Stripe?: StripeFactory }).Stripe;
      if (factory) resolve(factory); else reject(new Error('Stripe did not load'));
    };
    script.onerror = () => { loading = null; reject(new Error('Stripe did not load')); };
    document.head.append(script);
  });
  return loading;
}
