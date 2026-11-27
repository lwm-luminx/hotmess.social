// The web app's session: the token and, from the sign-in JSON it came with, the audience it was signed in on, kept in
// this browser's storage. It is also the SDK client's token store (src/lib/api.ts), so a sign-in or a session the API
// refuses shows here, and every page's navbar (Base.astro) reads it without loading the SDK.
import type { TokenStore } from 'audience-kit';

const TOKEN_KEY = 'hotmess.token';
const AUDIENCE_KEY = 'hotmess.audience';

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

function stored(key: string, value: string | null) {
  const s = storage();
  if (!s) return;
  if (value) s.setItem(key, value); else s.removeItem(key);
}

/** Fired on window when this page signs in or out, so the navbar's Sign in / Sign out (Base.astro) follows. */
export const SESSION_EVENT = 'hotmess:session';
function changed() {
  try { window.dispatchEvent(new Event(SESSION_EVENT)); } catch { /* not in a browser */ }
}

export const session = {
  get token(): string | null { return storage()?.getItem(TOKEN_KEY) ?? null; },
  get audienceId(): string | null { return storage()?.getItem(AUDIENCE_KEY) ?? null; },
  start(response: { token: string; audienceId?: string | null }) {
    stored(TOKEN_KEY, response.token);
    stored(AUDIENCE_KEY, response.audienceId ?? null);
    changed();
  },
  end() {
    stored(TOKEN_KEY, null);
    stored(AUDIENCE_KEY, null);
    changed();
  },
};

/** The session as the SDK keeps it: a sign-in saves here, and a session the API refuses is forgotten here. */
export const sessionStore: TokenStore = {
  loadToken: () => session.token,
  saveToken: (token) => { stored(TOKEN_KEY, token); changed(); },
  deleteToken: () => session.end(),
  loadAudienceId: () => session.audienceId,
  saveAudienceId: (audienceId) => stored(AUDIENCE_KEY, audienceId),
};
