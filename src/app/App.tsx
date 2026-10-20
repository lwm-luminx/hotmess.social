// The Hot Mess web app: routing, sign-in and data loading around the AudienceKit components in
// src/sdk. It renders /app/ and, through the 404 page, the share links /venues/<id>,
// /events/<id> and /people/<id>, which GitHub Pages cannot route statically.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, session, APIError } from '../lib/api';
import { facebookAccessToken } from '../lib/facebook';
import { routeFor, pathFor, linkCheck, type Route } from '../lib/routes';
import { reportError, startErrorReporting } from '../lib/errorReporting';
import ErrorBoundary from './ErrorBoundary';
import { EventView, NavigationProvider, NowView, PersonView, VenueView, type Navigation } from '../sdk';
import type { Event, Now, Person, Venue } from '../sdk/types';
import '../sdk/styles.css';

type Screen =
  | { state: 'loading' }
  | { state: 'signed-out' }
  | { state: 'message'; text: string }
  | { state: 'expired' }
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
    case 'expired': return 'Link expired';
    default: return 'Hot Mess';
  }
}

// Shown instead of the record for a share link past its expiry; the web app has no venue search, so it offers Now,
// which lists the venues around you.
function Expired({ onFindVenues }: { onFindVenues: () => void }) {
  return (
    <section className="card signin">
      <h1>This link has expired</h1>
      <p className="muted">Ask whoever sent it for a new one, or find a venue near you.</p>
      <button className="button" type="button" onClick={onFindVenues}>Find venues</button>
    </section>
  );
}

function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The website signs in with Facebook only; AudienceKit can turn it off, or
  // ask to warn people first ("Facebook login is only for testers").
  const [offersFacebook, setOffersFacebook] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [warned, setWarned] = useState(false);
  // Until the methods are known, so nobody skips a warning by clicking early.
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    let current = true;
    api.signInMethods().then((offered) => {
      if (current) setAsked(true);
      if (!current || !offered) return;
      setOffersFacebook(offered.methods.includes('facebook'));
      setWarning(offered.warnings.facebook ?? null);
    });
    return () => { current = false; };
  }, []);
  const signIn = async () => {
    setWarned(false);
    setBusy(true);
    setError(null);
    try {
      session.start(await api.signIn(await facebookAccessToken()));
      onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
      setBusy(false);
    }
  };
  if (!offersFacebook) {
    return (
      <section className="card signin">
        <h1>Sign in to Hot Mess</h1>
        <p className="muted">Signing in on the web isn't available right now. Use the Hot Mess app instead.</p>
      </section>
    );
  }
  if (warned && warning) {
    return (
      <section className="card signin" role="alertdialog" aria-labelledby="signin-warning-title" aria-describedby="signin-warning">
        <h1 id="signin-warning-title">Before you continue</h1>
        <p id="signin-warning">{warning}</p>
        <div className="signin-actions">
          <button className="button secondary" type="button" onClick={() => setWarned(false)}>Cancel</button>
          <button className="button" type="button" onClick={signIn}>Continue</button>
        </div>
      </section>
    );
  }
  return (
    <section className="card signin">
      <h1>Sign in to Hot Mess</h1>
      <p className="muted">Hot Mess uses your Facebook account to find your friends and your city's scene.</p>
      <button
        className="button"
        type="button"
        disabled={busy || !asked}
        onClick={() => (warning ? setWarned(true) : signIn())}
      >
        Continue with Facebook
      </button>
      {error ? <p className="error" role="alert">{error}</p> : null}
    </section>
  );
}

export default function App() {
  return <ErrorBoundary><HotMess /></ErrorBoundary>;
}

function HotMess() {
  // The path and query: a share link's query carries its signed expiry (?e=).
  const [path, setPath] = useState(() => location.pathname + location.search);
  const [screen, setScreen] = useState<Screen>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const onPop = () => setPath(location.pathname + location.search);
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const url = new URL(path, location.origin);
    const route = routeFor(url.pathname);
    if (!route) return setScreen({ state: 'message', text: "That page doesn't exist." });
    // An expired link never opens its record, signed in or not.
    const check = route.kind === 'now' ? 'open' : linkCheck(url.search);
    if (check === 'expired') return setScreen({ state: 'expired' });
    if (check === 'open' && !session.token) return setScreen({ state: 'signed-out' });

    let cancelled = false;
    setScreen({ state: 'loading' });
    const expired = check === 'ask' ? api.shareLinkExpired(pathFor(route), url.searchParams.get('e') ?? '') : Promise.resolve(false);
    expired.then(async (isExpired): Promise<Screen> => {
      if (isExpired) return { state: 'expired' };
      if (!session.token) return { state: 'signed-out' };
      return load(route);
    }).then(
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
    case 'expired': content = <Expired onFindVenues={() => go({ kind: 'now' })} />; break;
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
