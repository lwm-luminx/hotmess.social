// Sign in to Hot Mess on the web: the web app's sign-in card, and the gate in front of signed-in pages (SignedIn.tsx).
import { useEffect, useState } from 'react';
import { api, session } from '../lib/api';
import { facebookAccessToken } from '../lib/facebook';
import { appleSignIn, offersApple, prepareAppleSignIn } from '../lib/apple';
import type { TokenResponse } from '../sdk';
import './signin.css';

type Method = 'apple' | 'facebook';

// How each method signs in, and its button. Apple's follows Apple's own style
// (black, the Apple logo, "Continue with Apple").
const METHODS: Record<Method, { label: string; className: string; signIn: () => Promise<TokenResponse> }> = {
  apple: { label: 'Continue with Apple', className: 'button apple', signIn: async () => api.signInWithApple(await appleSignIn()) },
  facebook: { label: 'Continue with Facebook', className: 'button', signIn: async () => api.signIn(await facebookAccessToken()) },
};

function AppleLogo() {
  return (
    <svg aria-hidden="true" width="16" height="19" viewBox="0 0 814 1000" fill="currentColor">
      <path d="M788 341c-6 4-108 62-108 190 0 149 131 202 135 203-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-164-40c-77 0-104 41-167 41s-106-58-156-129C46 790 0 664 0 545 0 353 125 251 248 251c65 0 120 43 161 43 39 0 100-45 175-45 28 0 130 3 204 92zM554 159c31-37 53-88 53-139 0-7-1-14-2-20-50 2-110 34-146 76-28 32-55 83-55 135 0 8 1 16 2 18 3 1 8 1 13 1 45 0 102-30 135-71z" />
    </svg>
  );
}

// lede replaces the line under the heading, for a page that says why it needs sign-in.
export default function SignIn({ onSignedIn, lede }: { onSignedIn: () => void; lede?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The ways in AudienceKit offers this audience, of the ones the website has
  // (Facebook, and Apple when this build has a Services ID), with the warning
  // to show before each one that has one ("Facebook login is only for testers").
  // Facebook alone, with no warnings, when the API can't say.
  const [offered, setOffered] = useState<Method[]>(['facebook']);
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [warning, setWarning] = useState<Method | null>(null);
  // Until the methods are known, so nobody skips a warning by clicking early.
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    let current = true;
    api.signInMethods().then((answer) => {
      if (current) setAsked(true);
      if (!current || !answer) return;
      const methods = (['apple', 'facebook'] as const).filter((method) =>
        answer.methods.includes(method) && (method !== 'apple' || offersApple));
      setOffered(methods);
      setWarnings(answer.warnings);
      // Ready before the click, so the click can open Apple's window (src/lib/apple.ts).
      if (methods.includes('apple')) prepareAppleSignIn().catch(() => {});
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
      <div className="signin-methods">
        {offered.map((method) => (
          <button
            key={method}
            className={METHODS[method].className}
            type="button"
            disabled={busy || !asked}
            onClick={() => (warnings[method] ? setWarning(method) : signIn(method))}
          >
            {method === 'apple' ? <AppleLogo /> : null}
            {METHODS[method].label}
          </button>
        ))}
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
    </section>
  );
}
