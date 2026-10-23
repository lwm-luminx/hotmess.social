// Parses hotmess.social share links, matching the iOS app's DeepLink parser
// (hot_mess_ios HotMess/App/AppRoute.swift) so a link opens the same thing
// in the browser as in the app.

export type Route =
  | { kind: 'now' }
  | { kind: 'venue'; id: string }
  | { kind: 'event'; id: string }
  | { kind: 'person'; id: string }
  | { kind: 'post'; id: string }
  | { kind: 'safety-alert'; id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KINDS = { venues: 'venue', events: 'event', people: 'person', posts: 'post', 'safety-alerts': 'safety-alert' } as const;

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
    case 'post': return `/posts/${route.id}`;
    case 'safety-alert': return `/safety-alerts/${route.id}`;
  }
}

// Signed share links carry ?e=<expiry>.<signature>: the expiry in Unix seconds, base36, and the API's signature over
// the path and expiry (audience-kit api/doc/SHARE_CARDS.md). Links without one are from before signing and still open.
const EXPIRY_TOKEN = /^([0-9a-z]{1,10})\.[A-Za-z0-9_-]{16}$/i;

/** When a share link's `e` token says it expires, or null when the token can't be read. */
export function linkExpiry(token: string): Date | null {
  const match = EXPIRY_TOKEN.exec(token);
  return match ? new Date(parseInt(match[1], 36) * 1000) : null;
}

/**
 * What to do about a share link's `e` before opening it: nothing for an unsigned link, 'expired' when its own expiry
 * has passed (no need to ask), else 'ask' the API, which alone can check the signature.
 */
export function linkCheck(search: string, now: number = Date.now()): 'open' | 'expired' | 'ask' {
  const token = new URLSearchParams(search).get('e');
  if (token == null) return 'open';
  const expiry = linkExpiry(token);
  return expiry && expiry.getTime() <= now ? 'expired' : 'ask';
}
