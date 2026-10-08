// The Hot Mess web app: routing, sign-in and data loading around the AudienceKit components in
// src/sdk. It renders /app/ and, through the 404 page, the share links /venues/<id>,
// /events/<id> and /people/<id>, which GitHub Pages cannot route statically.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, session, APIError } from '../lib/api';
import { facebookAccessToken } from '../lib/facebook';
import { routeFor, pathFor, type Route } from '../lib/routes';
import { reportError, startErrorReporting } from '../lib/errorReporting';
import ErrorBoundary from './ErrorBoundary';
import { EventView, NavigationProvider, NowView, PersonView, VenueView, type Navigation } from '../sdk';
import type { Event, Now, Person, Venue } from '../sdk/types';
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
    case 'venue': {
      const [venue, events] = await Promise.all([api.venue(route.id), api.venueEvents(route.id)]);
      return { state: 'venue', venue, events };
    }
    case 'event': return { state: 'event', event: await api.event(route.id) };
    case 'person': return { state: 'person', person: await api.person(route.id) };
  }
}

function titleFor(screen: Screen): string {
  switch (screen.state) {
    case 'now': return 'Now';
    case 'venue': return screen.venue.name;
    case 'event': return screen.event.name;
    case 'person': return screen.person.name;
    default: return 'Hot Mess';
  }
}

function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="card signin">
      <h1>Sign in to Hot Mess</h1>
      <p className="muted">Hot Mess uses your Facebook account to find your friends and your city's scene.</p>
      <button
        className="button"
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            session.token = (await api.signIn(await facebookAccessToken())).token;
            onSignedIn();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Sign-in failed');
            setBusy(false);
          }
        }}
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
        if (e instanceof APIError && e.status === 401) return setScreen({ state: 'signed-out' });
        if (e instanceof APIError && e.status === 404) return setScreen({ state: 'message', text: "We couldn't find that." });
        if (!(e instanceof APIError) || e.status >= 500) reportError(e);
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

  return <NavigationProvider value={navigation}>{content}</NavigationProvider>;
}
