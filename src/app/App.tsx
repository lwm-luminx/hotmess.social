// The Hot Mess web app: routing, sign-in and data loading around the AudienceKit components in
// src/sdk. It renders /app/ and, through the 404 page, the share links /venues/<id>,
// /events/<id> and /people/<id>, which GitHub Pages cannot route statically.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, session, APIError } from '../lib/api';
import { facebookAccessToken } from '../lib/facebook';
import { appleSignIn, offersApple } from '../lib/apple';
import { routeFor, pathFor, type Route } from '../lib/routes';
import { reportError, startErrorReporting } from '../lib/errorReporting';
import ErrorBoundary from './ErrorBoundary';
import { EventView, NavigationProvider, NowView, PersonView, VenueView, type Navigation } from '../sdk';
import type { Event, Now, Person, TokenResponse, Venue } from '../sdk/types';
import '../sdk/styles.css';

type Screen =
  | { state: 'loading' }
  | { state: 'signed-out' }
  | { state: 'message'; text: string }
  | { state: 'now'; now: Now }
  | { state: 'venue'; venue: Venue; events: Event[] }
  | { state: 'event'; event: Event }
  | { state: 'person'; person: Person };

// The API picks the venue you're at, or your city, from where you are.
function here(): Promise<{ latitude: number; longitude: number } | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => navigator.geolocation.getCurrentPosition(
    ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
    () => resolve(null),
    { maximumAge: 5 * 60 * 1000, timeout: 15000 },
  ));
}

async function load(route: Route): Promise<Screen> {
  switch (route.kind) {
    case 'now': {
      const position = await here();
      if (!position) return { state: 'message', text: "Hot Mess shows what's happening around you. Allow location access for hotmess.social and reload." };
      return { state: 'now', now: await api.now(position.latitude, position.longitude) };
    }
    case 'venue': return { state: 'venue', ...await api.venue(route.id) };
    case 'event': return { state: 'event', event: await api.event(route.id) };
    case 'person': return { state: 'person', person: await api.person(route.id) };
  }
}

function titleFor(screen: Screen): string {
  switch (screen.state) {
    case 'now': return 'Now';
    case 'venue': return screen.venue.name ?? 'Venue';
    case 'event': return screen.event.name ?? 'Event';
    case 'person': return screen.person.name ?? 'Person';
    default: return 'Hot Mess';
  }
}

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

function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
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
      setOffered((['apple', 'facebook'] as const).filter((method) =>
        answer.methods.includes(method) && (method !== 'apple' || offersApple)));
      setWarnings(answer.warnings);
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
        {offered.includes('facebook')
          ? "Sign in to see what's happening around you. With Facebook, Hot Mess also finds your friends there."
          : "Sign in to see what's happening around you."}
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

export default function App() {
  return <ErrorBoundary><HotMess /></ErrorBoundary>;
}

function HotMess() {
  const [path, setPath] = useState(() => location.pathname);
  const [screen, setScreen] = useState<Screen>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const onPop = () => setPath(location.pathname);
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const route = routeFor(path);
    if (!route) return setScreen({ state: 'message', text: "That page doesn't exist." });
    if (!session.token) return setScreen({ state: 'signed-out' });

    let cancelled = false;
    setScreen({ state: 'loading' });
    load(route).then(
      (next) => { if (!cancelled) setScreen(next); },
      (e) => {
        if (cancelled) return;
        // The API says what went wrong with a code (src/lib/apiErrors.ts), never with its message.
        if (e instanceof APIError && e.signedOut) return setScreen({ state: 'signed-out' });
        if (e instanceof APIError && e.notFound) return setScreen({ state: 'message', text: "We couldn't find that." });
        if (e instanceof APIError && e.code === 'FORBIDDEN') return setScreen({ state: 'message', text: "You can't see that." });
        if (!(e instanceof APIError) || e.reportable) reportError(e);
        setScreen({ state: 'message', text: "Hot Mess couldn't reach its server. Try again in a moment." });
      },
    );
    return () => { cancelled = true; };
  }, [path, attempt]);

  useEffect(() => {
    document.title = `${titleFor(screen)} · Hot Mess`;
    if (screen.state !== 'loading') window.scrollTo(0, 0);
  }, [screen]);

  const go = useCallback((route: Route) => {
    history.pushState(null, '', pathFor(route));
    setPath(location.pathname);
  }, []);

  const navigation = useMemo<Navigation>(() => ({
    href: (target) => pathFor(target),
    onNavigate: (target, event) => { event.preventDefault(); go(target); },
  }), [go]);

  const logOut = () => {
    session.end();
    history.replaceState(null, '', pathFor({ kind: 'now' }));
    setPath(location.pathname);
    setScreen({ state: 'signed-out' });
    // Clean up pending loads even when we're already on /app/.
    setAttempt((n) => n + 1);
  };

  let content;
  switch (screen.state) {
    case 'loading': content = <p className="muted">Loading…</p>; break;
    case 'signed-out': content = <SignIn onSignedIn={() => setAttempt((n) => n + 1)} />; break;
    case 'message': content = <p className="muted">{screen.text}</p>; break;
    case 'now': content = <NowView now={screen.now} />; break;
    case 'venue': content = <VenueView venue={screen.venue} events={screen.events} />; break;
    case 'event': content = <EventView event={screen.event} />; break;
    case 'person': content = <PersonView person={screen.person} />; break;
  }

  return <NavigationProvider value={navigation}>
    {session.token ? <div className="app-account">
      <button className="button secondary" type="button" onClick={logOut}>Log out</button>
    </div> : null}
    {content}
  </NavigationProvider>;
}
