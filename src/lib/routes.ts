// Parses hotmess.social share links, matching the iOS app's DeepLink parser
// (hot_mess_ios HotMess/App/AppRoute.swift) so a link opens the same thing
// in the browser as in the app.

export type Route =
  | { kind: 'now' }
  | { kind: 'venue'; id: string }
  | { kind: 'event'; id: string }
  | { kind: 'person'; id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KINDS = { venues: 'venue', events: 'event', people: 'person' } as const;

export function routeFor(pathname: string): Route | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'app') segments.shift();
  if (segments.length === 0) return { kind: 'now' };
  if (segments.length < 2) return null;

  const kind = KINDS[segments[0] as keyof typeof KINDS];
  const id = segments[1];
  if (!kind || !UUID.test(id)) return null;

  return { kind, id: id.toLowerCase() };
}

export function pathFor(route: Route): string {
  switch (route.kind) {
    case 'now': return '/app/';
    case 'venue': return `/venues/${route.id}`;
    case 'event': return `/events/${route.id}`;
    case 'person': return `/people/${route.id}`;
  }
}
