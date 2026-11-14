// Sign in with Google through Google Identity Services' token client, in a
// popup, like the AudienceKit admin console's Google button. Google answers
// with an OAuth access token for openid, email and profile; POST
// /v1/token/google checks with Google that it was issued to one of the API's
// client IDs (GOOGLE_CLIENT_IDS) and reads the person's name and email
// (api/doc/TOKENS.md, "Sign in with Google").
import { GOOGLE_CLIENT_ID } from './config';

const SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const SCOPE = 'openid email profile';

interface TokenResponse { access_token?: string; error?: string; error_description?: string }
interface TokenClient { requestAccessToken(overrides?: { prompt?: string }): void }
interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type?: string; message?: string }) => void;
}
interface GoogleOAuth2 { initTokenClient(config: TokenClientConfig): TokenClient }

declare global {
  interface Window { google?: { accounts?: { oauth2?: GoogleOAuth2 } } }
}

// Whether this build can sign in with Google at all.
export const offersGoogle = GOOGLE_CLIENT_ID !== '';

let loading: Promise<GoogleOAuth2> | null = null;

function sdk(): Promise<GoogleOAuth2> {
  const loaded = window.google?.accounts?.oauth2;
  if (loaded) return Promise.resolve(loaded);
  loading ??= new Promise<GoogleOAuth2>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2) resolve(oauth2);
      else reject(new Error('Could not load Sign in with Google'));
    };
    script.onerror = () => reject(new Error('Could not load Sign in with Google'));
    document.head.append(script);
  }).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

// One sign-in, ready to open: Google's script loaded and a token client made
// whose callbacks settle the sign-in in flight. As with Apple, a click may only
// open a popup while nothing has been awaited since (Safari blocks it
// otherwise), so the card makes one ready before the click
// (prepareGoogleSignIn) and the click opens Google's window at once
// (googleSignIn).
interface Pending { resolve: (token: string) => void; reject: (error: Error) => void }

let client: TokenClient | null = null;
let pending: Pending | null = null;

function settle(outcome: { token: string } | { error: Error }) {
  const current = pending;
  pending = null;
  if (!current) return;
  if ('token' in outcome) current.resolve(outcome.token);
  else current.reject(outcome.error);
}

// Gets sign-in ready; the card waits for it before enabling Google's button.
export async function prepareGoogleSignIn(): Promise<void> {
  if (client) return;
  const oauth2 = await sdk();
  client = oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPE,
    callback: (response) => settle(response.access_token
      ? { token: response.access_token }
      : { error: new Error(response.error === 'access_denied' ? 'Google sign-in was cancelled' : "Google sign-in didn't finish") }),
    error_callback: (error) => settle({
      error: new Error(error.type === 'popup_closed'
        ? 'Google sign-in was cancelled'
        : error.type === 'popup_failed_to_open'
          ? 'Your browser blocked the Google sign-in window. Allow pop-ups for hotmess.social and try again.'
          : "Google sign-in didn't finish"),
    }),
  });
}

// Opens Google's popup and resolves with the access token, or rejects when the
// person closes it or Google refuses.
export async function googleAccessToken(): Promise<string> {
  if (!client) await prepareGoogleSignIn();
  // A sign-in left open (its popup never answered) gives way to this one.
  settle({ error: new Error("Google sign-in didn't finish") });
  const token = new Promise<string>((resolve, reject) => { pending = { resolve, reject }; });
  client!.requestAccessToken({ prompt: 'select_account' });
  return token;
}
