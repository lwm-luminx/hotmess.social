// Sign in with Apple through Apple's JS (Sign in with Apple JS) in a popup.
// Apple answers with an identity token whose audience is the Hot Mess Services
// ID, and a one-time authorization code the API keeps so deleting the account
// can revoke it (api/doc/TOKENS.md). The Services ID is the one the Android
// app uses, so the API takes its tokens only with the nonce: the site puts
// the SHA-256 of a random value in the request and signs in with the value.
import { APPLE_SERVICES_ID } from './config';

const SCRIPT_URL = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

// What POST /v1/token/apple needs. The name comes only the first time someone
// signs in with this Services ID.
export interface AppleSignIn {
  identityToken: string;
  authorizationCode?: string;
  firstName?: string;
  lastName?: string;
  // The return URL the code was issued for, which Apple needs again to exchange it.
  redirectUri: string;
  nonce: string;
}

interface AppleAuthResponse {
  authorization?: { id_token?: string; code?: string; state?: string };
  user?: { name?: { firstName?: string; lastName?: string } };
}

interface AppleAuth {
  init(config: { clientId: string; scope: string; redirectURI: string; state: string; nonce: string; usePopup: boolean }): void;
  signIn(): Promise<AppleAuthResponse>;
}

declare global {
  interface Window { AppleID?: { auth?: AppleAuth } }
}

// Whether this build can sign in with Apple at all.
export const offersApple = APPLE_SERVICES_ID !== '';

// The Services ID's return URL: the web app itself. The popup reports back to
// the page, so Apple never loads it; it only has to match the Services ID's list.
export function appleRedirectUri(origin: string = location.origin): string {
  return `${origin}/app/`;
}

let loading: Promise<AppleAuth> | null = null;

function sdk(): Promise<AppleAuth> {
  if (window.AppleID?.auth) return Promise.resolve(window.AppleID.auth);
  loading ??= new Promise<AppleAuth>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.AppleID?.auth ? resolve(window.AppleID.auth) : reject(new Error('Could not load Sign in with Apple')));
    script.onerror = () => reject(new Error('Could not load Sign in with Apple'));
    document.head.append(script);
  }).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

function random(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Opens Apple's popup and resolves with what the API needs, or rejects when
// the person closes it or Apple refuses.
export async function appleSignIn(): Promise<AppleSignIn> {
  const auth = await sdk();
  const state = random();
  const nonce = random();
  const redirectUri = appleRedirectUri();
  auth.init({ clientId: APPLE_SERVICES_ID, scope: 'name email', redirectURI: redirectUri, state, nonce: await sha256Hex(nonce), usePopup: true });
  let response: AppleAuthResponse;
  try {
    response = await auth.signIn();
  } catch (error) {
    const reason = (error as { error?: string } | null)?.error;
    throw new Error(reason === 'popup_closed_by_user' || reason === 'user_cancelled_authorize'
      ? 'Apple sign-in was cancelled'
      : "Apple sign-in didn't finish", { cause: error });
  }
  const authorization = response.authorization;
  if (!authorization?.id_token || authorization.state !== state) throw new Error("Apple sign-in didn't finish");
  return {
    identityToken: authorization.id_token,
    authorizationCode: authorization.code,
    firstName: response.user?.name?.firstName,
    lastName: response.user?.name?.lastName,
    redirectUri,
    nonce,
  };
}
