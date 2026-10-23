// Ping invitations: https://hotmess.social/pings/<id>?e=<token>, texted from a sender's phone to contacts who may not
// have the app. The page (src/pages/pings/[id].astro) asks the API for the invitation's preview,
// GET /v1/share/invitation (audience-kit api/doc/SHARE_CARDS.md), which answers without auth and never exposes the
// sender's circle. An expired, altered or ended invitation answers an error, and the page says the Ping has ended.
import { pathFor, routeFor } from './routes.ts';

export interface InvitationTarget {
  id: string;
  name: string;
  /** The pick's own page (/venues/<id> or /events/<id>), or null when the API gave none this site can open. */
  path: string | null;
}

export interface Invitation {
  kind: 'ping';
  id: string;
  /** "Jordan wants to go out" */
  title: string;
  note: string | null;
  senderName: string | null;
  expiresAt: Date;
  targets: InvitationTarget[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The Ping's id for a /pings/<id> path (any case, optional trailing slash), lower-cased, or null. */
export function pingId(pathname: string): string | null {
  const match = /^\/pings\/([^/]+)\/?$/.exec(pathname);
  return match && UUID.test(match[1]) ? match[1].toLowerCase() : null;
}

/** The query for GET /v1/share/invitation. */
export function invitationQuery(host: string, id: string, e: string): URLSearchParams {
  return new URLSearchParams({ host, path: `/pings/${id}`, e });
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/** Only the site's own record pages are linked, so a pick can never point anywhere else. */
function targetPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const route = routeFor(value);
  return route && route.kind !== 'now' ? pathFor(route) : null;
}

/** The API's snake_case invitation JSON as an Invitation, or null when it isn't one. */
export function parseInvitation(value: unknown): Invitation | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const title = text(v.title);
  const expiresAt = typeof v.expires_at === 'string' ? new Date(v.expires_at) : null;
  if (v.kind !== 'ping' || typeof v.id !== 'string' || !title || !expiresAt || isNaN(expiresAt.getTime())) return null;
  const targets = (Array.isArray(v.targets) ? v.targets : []).flatMap((t): InvitationTarget[] => {
    const target = t as Record<string, unknown> | null;
    const name = text(target?.name);
    return target && name ? [{ id: String(target.id ?? ''), name, path: targetPath(target.path) }] : [];
  });
  return { kind: 'ping', id: v.id, title, note: text(v.note), senderName: text(v.sender_name), expiresAt, targets };
}

/**
 * "Ends 5:00 AM" in the reader's own time, with the weekday ("Ends Sat 5:00 AM") when that's more than a day away.
 */
export function endsLabel(expiresAt: Date, now: Date = new Date(), locale?: string, timeZone?: string): string {
  const soon = expiresAt.getTime() - now.getTime() < 24 * 60 * 60 * 1000;
  const time = new Intl.DateTimeFormat(locale, {
    hour: 'numeric', minute: '2-digit', timeZone, ...(soon ? {} : { weekday: 'short' }),
  }).format(expiresAt);
  return `Ends ${time}`;
}
