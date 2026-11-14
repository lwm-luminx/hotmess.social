// Sign in to Hot Mess on the web: the web app's sign-in card, and the gate in front of signed-in pages (SignedIn.tsx).
import { useEffect, useState } from 'react';
import { api, session } from '../lib/api';
import { facebookAccessToken, prepareFacebookSignIn } from '../lib/facebook';
import { appleSignIn, offersApple, prepareAppleSignIn } from '../lib/apple';
import { googleAccessToken, offersGoogle, prepareGoogleSignIn } from '../lib/google';
import type { TokenResponse } from '../sdk';
import './signin.css';

type Method = 'apple' | 'google' | 'facebook';

// Hot Mess is for adults (the terms say 18+), so nobody signs in on the web before confirming it, the same check
// the apps make before sign-in. The confirmation is kept in this browser, so it's asked once.
const ADULT_KEY = 'hotmess.adult';
function confirmedAdult(): boolean {
  try { return window.localStorage.getItem(ADULT_KEY) === '1'; } catch { return false; }
}
function rememberAdult(confirmed: boolean) {
  try {
    if (confirmed) window.localStorage.setItem(ADULT_KEY, '1'); else window.localStorage.removeItem(ADULT_KEY);
  } catch { /* private browsing: asked again next time */ }
}

// How each method signs in, and its button. Apple's follows Apple's own style
// (black, the Apple logo, "Continue with Apple"), and Google's Google's (white,
// the "G" logo, "Continue with Google").
const METHODS: Record<Method, { label: string; className: string; signIn: () => Promise<TokenResponse> }> = {
  apple: { label: 'Continue with Apple', className: 'button apple', signIn: async () => api.signInWithApple(await appleSignIn()) },
  google: { label: 'Continue with Google', className: 'button google', signIn: async () => api.signInWithGoogle(await googleAccessToken()) },
  facebook: { label: 'Continue with Facebook', className: 'button', signIn: async () => api.signIn(await facebookAccessToken()) },
};

function AppleLogo() {
  return (
    <svg aria-hidden="true" width="16" height="19" viewBox="0 0 814 1000" fill="currentColor">
      <path d="M788 341c-6 4-108 62-108 190 0 149 131 202 135 203-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-164-40c-77 0-104 41-167 41s-106-58-156-129C46 790 0 664 0 545 0 353 125 251 248 251c65 0 120 43 161 43 39 0 100-45 175-45 28 0 130 3 204 92zM554 159c31-37 53-88 53-139 0-7-1-14-2-20-50 2-110 34-146 76-28 32-55 83-55 135 0 8 1 16 2 18 3 1 8 1 13 1 45 0 102-30 135-71z" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// lede replaces the line under the heading, for a page that says why it needs sign-in.
export default function SignIn({ onSignedIn, lede }: { onSignedIn: () => void; lede?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adult, setAdult] = useState(confirmedAdult);
  // The ways in AudienceKit offers this audience, of the ones the website has
  // (Facebook, Apple when this build has a Services ID, and Google when it has a
  // client ID), with the warning
  // to show before each one that has one ("Facebook login is only for testers").
  // Facebook alone, with no warnings, when the API can't say.
  const [offered, setOffered] = useState<Method[]>(['facebook']);
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [warning, setWarning] = useState<Method | null>(null);
  // Until the methods are known, so nobody skips a warning by clicking early.
  const [asked, setAsked] = useState(false);
  // Apple's window may only open straight from the click (src/lib/apple.ts), so its button waits until a sign-in is
  // ready; one that couldn't be made ready lets the click try anyway, and says why it failed.
  const [appleReady, setAppleReady] = useState(false);
  const readyApple = () => {
    setAppleReady(false);
    return prepareAppleSignIn().catch(() => {}).then(() => setAppleReady(true));
  };
  // Google's window, likewise, opens only straight from the click.
  const [googleReady, setGoogleReady] = useState(false);
  const readyGoogle = () => prepareGoogleSignIn().catch(() => {}).then(() => setGoogleReady(true));
  useEffect(() => {
    let current = true;
    // Facebook's window may only open straight from the click too, so its SDK loads now (src/lib/facebook.ts).
    prepareFacebookSignIn().catch(() => {});
    api.signInMethods().then((answer) => {
      if (current) setAsked(true);
      if (!current || !answer) return;
      const methods = (['apple', 'google', 'facebook'] as const).filter((method) =>
        answer.methods.includes(method) && (method !== 'apple' || offersApple) && (method !== 'google' || offersGoogle));
      setOffered(methods);
      setWarnings(answer.warnings);
      // Ready before the click, so the click can open Apple's window (src/lib/apple.ts).
      if (methods.includes('apple')) void readyApple();
      if (methods.includes('google')) void readyGoogle();
    });
    return () => { current = false; };
  }, []);
  const signIn = async (method: Method) => {
    setWarning(null);
    setBusy(true);
    setError(null);
    try {
      session.start(await METHODS[method].signIn());
      onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
      setBusy(false);
      if (method === 'apple') void readyApple();
    }
  };
  if (offered.length === 0) {
    return (
      <section className="card signin">
        <h1>Sign in to Hot Mess</h1>
        <p className="muted">Signing in on the web isn't available right now. Use the Hot Mess app instead.</p>
      </section>
    );
  }
  if (warning) {
    return (
      <section className="card signin" role="alertdialog" aria-labelledby="signin-warning-title" aria-describedby="signin-warning">
        <h1 id="signin-warning-title">Before you continue</h1>
        <p id="signin-warning">{warnings[warning]}</p>
        <div className="signin-actions">
          <button className="button secondary" type="button" onClick={() => setWarning(null)}>Cancel</button>
          <button className="button" type="button" onClick={() => signIn(warning)}>Continue</button>
        </div>
      </section>
    );
  }
  return (
    <section className="card signin">
      <h1>Sign in to Hot Mess</h1>
      <p className="muted">
        {lede ?? (offered.includes('facebook')
          ? "Sign in to see what's happening around you. With Facebook, Hot Mess also finds your friends there."
          : "Sign in to see what's happening around you.")}
      </p>
      <label className="signin-adult">
        <input
          type="checkbox"
          checked={adult}
          onChange={(event) => { setAdult(event.target.checked); rememberAdult(event.target.checked); }}
        />
        <span>
          I'm 18 or older, and I agree to the <a href="https://audiencekit.com/terms/">Terms</a> and{' '}
          <a href="https://audiencekit.com/privacy/">Privacy Policy</a>.
        </span>
      </label>
      <div className="signin-methods">
        {offered.map((method) => (
          <button
            key={method}
            className={METHODS[method].className}
            type="button"
            disabled={busy || !asked || !adult || (method === 'apple' && !appleReady) || (method === 'google' && !googleReady)}
            onClick={() => (warnings[method] ? setWarning(method) : signIn(method))}
          >
            {method === 'apple' ? <AppleLogo /> : method === 'google' ? <GoogleLogo /> : null}
            {METHODS[method].label}
          </button>
        ))}
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
    </section>
  );
}
