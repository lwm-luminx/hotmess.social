// Sign in with Instagram, for Instagram Business and Creator accounts. Instagram's OAuth needs AudienceKit's app
// secret, so the API runs it (api/doc/TOKENS.md, "Sign in with Instagram"): the site sends the browser to
// /v1/token/instagram/authorize with the SHA-256 of a verifier it keeps in this tab, and Instagram's answer comes back
// to the same page as an `instagram_ticket` that only that verifier redeems (api.signInWithInstagram).
const STORAGE_KEY = 'hotmess.instagram';

function hex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// The URL that starts a sign-in coming back to `returnTo`; the verifier stays in this tab's storage.
export async function beginInstagramSignIn(apiBase: string, returnTo: string = location.href, storage: Storage = sessionStorage): Promise<string> {
  const verifier = hex(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  // Fails before leaving the page if storage is off: the ticket has to come back to this browser.
  storage.setItem(STORAGE_KEY, verifier);
  const url = new URL('/v1/token/instagram/authorize', apiBase);
  url.search = new URLSearchParams({ return_to: returnTo, challenge }).toString();
  return url.toString();
}

export type InstagramReturn = { ticket: string; verifier: string } | { error: string } | null;

// What Instagram sent back to this page: a ticket with this tab's verifier, an error, or null when this page isn't
// the end of a sign-in. Takes it out of `url` (the caller puts that in the address bar) and out of storage.
export function takeInstagramReturn(url: URL, storage: Storage = sessionStorage): InstagramReturn {
  const ticket = url.searchParams.get('instagram_ticket');
  const error = url.searchParams.get('instagram_error');
  if (!ticket && !error) return null;

  for (const key of ['instagram_ticket', 'instagram_error', 'instagram_error_description']) url.searchParams.delete(key);
  const verifier = storage.getItem(STORAGE_KEY);
  storage.removeItem(STORAGE_KEY);
  if (error) return { error: error === 'access_denied' ? 'Instagram sign-in was cancelled.' : "Instagram didn't sign you in. Try again." };
  if (!ticket || !verifier) return { error: 'Start Instagram sign-in again from this page.' };
  return { ticket, verifier };
}
