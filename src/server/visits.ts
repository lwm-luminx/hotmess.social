// Counts page visits ourselves, in place of Google Analytics. Each page tells POST /visit its own path when it opens
// (layouts/Base.astro), and the Worker writes one line to its own logs (Workers Logs, `observability` in
// wrangler.jsonc). Marketing pages are static files the Worker never sees, which is why the page has to say so. A line says which kind of page was opened,
// never who opened it: no IP address, no user agent, no cookie, no query string and no identifier of any kind. So
// nothing here needs consent, and no third party hears about a visit.
//
// Count them in the Cloudflare dashboard's Workers Logs: filter on `visit` and group by `page` or `path`.

export interface Visit {
  /** The kind of page: home, venue, event, app, … */
  page: string;
  /** The path opened. Listing pages keep their ID (a venue is public); anything else with an ID has it left out. */
  path: string;
  /** The site that linked here (its host only), when another site did. */
  from?: string;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// Public listings, whose pages are the same for everyone. Their ID says which venue, not which person.
const LISTING = /^\/(venues|events|posts)\/[0-9a-f-]{36}$/i;
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|monitor|headless|lighthouse|curl|wget|python|http/i;
const ASSET = /\.[a-z0-9]{2,5}$/i;

/** What a page tells us when it's opened: its own path and the page that linked to it. */
export interface Opened { path?: unknown; referrer?: unknown }

/** The visit an opened page counts as, or null when it isn't a person opening one of our pages. */
export function visitFor(opened: Opened, userAgent: string | null, ownHost: string): Visit | null {
  if (typeof opened.path !== 'string' || !opened.path.startsWith('/') || opened.path.length > 300) return null;
  if (BOT.test(userAgent ?? 'bot')) return null;

  let path = opened.path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (ASSET.test(path) || path.startsWith('/_')) return null;
  // The signed-in app, pings and short links: only that one was opened, never which.
  if (!LISTING.test(path)) path = path.replace(UUID, ':id');
  if (path.startsWith('/app')) path = '/app';
  if (path.startsWith('/v/')) path = '/v/:code';

  const visit: Visit = { page: pageKind(path), path };
  const from = referrerHost(typeof opened.referrer === 'string' ? opened.referrer : null, ownHost);
  if (from) visit.from = from;
  return visit;
}

function pageKind(path: string): string {
  if (path === '/') return 'home';
  const first = path.split('/')[1];
  return { venues: 'venue', events: 'event', posts: 'post' }[first] ?? first;
}

function referrerHost(referer: string | null, own: string): string | undefined {
  if (!referer) return undefined;
  try {
    const host = new URL(referer).host;
    return host && host !== own ? host : undefined;
  } catch {
    return undefined;
  }
}

/** Writes the visit to the Worker's log. Never throws: counting must not get in the way of anything. */
export function recordVisit(opened: Opened, userAgent: string | null, ownHost: string,
  log: (line: string) => void = console.log): void {
  try {
    const visit = visitFor(opened, userAgent, ownHost);
    if (visit) log(JSON.stringify({ visit }));
  } catch {
    // Not counted.
  }
}
