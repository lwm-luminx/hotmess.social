// Tonight at a venue for a screen facing the room (/venues/<id>/display): the API's PublicTonight
// (audience_kit_api doc/PUBLIC_LISTINGS.md, "Venue display"), read with the site's service credential, so only
// what anyone signed out may see. Performers who aren't Public are counted, never named.

export interface DisplayPerson { name: string; image?: string }
export interface DisplayEntry {
  id: string;
  kind: 'act' | 'intermission' | 'segment';
  role: string | null;
  title: string | null;
  people: DisplayPerson[];
  more: number;
  startsAt: string | null;
  startTiming: 'hard' | 'soft' | 'none';
  state: 'upcoming' | 'on' | 'done';
}
export interface DisplayEvent { id: string; name: string; startAt?: string }
export interface VenueTonight {
  venue: { id: string; title: string; image?: string; timeZone: string };
  night: string;
  events: DisplayEvent[];
  lineup: DisplayEntry[];
}

const text = (value: unknown) => typeof value === 'string' ? value : null;
const list = (value: unknown) => Array.isArray(value) ? value as Record<string, unknown>[] : [];

export function venueTonight(body: Record<string, unknown>): VenueTonight {
  const venue = (body.venue ?? {}) as Record<string, unknown>;
  return {
    venue: { id: String(venue.id), title: text(venue.title) ?? 'Tonight', image: text(venue.image) ?? undefined,
      timeZone: text(venue.time_zone) ?? 'America/Los_Angeles' },
    night: String(body.night ?? ''),
    events: list(body.events).map((event) => ({ id: String(event.id), name: text(event.name) ?? '',
      startAt: text(event.start_at) ?? undefined })),
    lineup: list(body.lineup).map((entry) => ({
      id: String(entry.id),
      kind: (['act', 'intermission', 'segment'].includes(String(entry.kind)) ? entry.kind : 'act') as DisplayEntry['kind'],
      role: text(entry.role),
      title: text(entry.title),
      people: list(entry.people).map((person) => ({ name: text(person.name) ?? '', image: text(person.image) ?? undefined }))
        .filter((person) => person.name),
      more: typeof entry.more === 'number' ? entry.more : 0,
      startsAt: text(entry.starts_at),
      startTiming: (['hard', 'soft'].includes(String(entry.start_timing)) ? entry.start_timing : 'none') as DisplayEntry['startTiming'],
      state: (['on', 'done'].includes(String(entry.state)) ? entry.state : 'upcoming') as DisplayEntry['state'],
    })),
  };
}

const ROLES: Record<string, string> = { host: 'Host', dj: 'DJ', performer: 'Performer', mc: 'MC', singer: 'Singer' };

/** Who's on: the Public names, "and 2 more" for the rest, else the billing, else what they do. */
export function entryName(entry: DisplayEntry): string {
  const names = entry.people.map((person) => person.name);
  if (names.length && entry.more) return `${names.join(' & ')} + ${entry.more} more`;
  if (names.length) return names.join(' & ');
  if (entry.title) return entry.title;
  if (entry.kind === 'intermission') return 'Intermission';
  if (entry.more > 1) return `${entry.more} performers`;
  return ROLES[entry.role ?? ''] ?? 'Coming up';
}

/** What they do, under the name: the role, or nothing for an intermission or a segment. */
export function entryRole(entry: DisplayEntry): string {
  return entry.kind === 'act' ? ROLES[entry.role ?? ''] ?? '' : '';
}

export function clock(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).format(at);
}

/** A set time as "9:30 PM", a soft one as "~9:30 PM", and nothing for one that goes on in order. */
export function entryTime(entry: DisplayEntry, timeZone: string): string {
  if (!entry.startsAt || (entry.startTiming === 'none' && entry.state === 'upcoming')) return '';
  const at = clock(new Date(entry.startsAt), timeZone);
  return entry.startTiming === 'soft' && entry.state === 'upcoming' ? `~${at}` : at;
}

/** The running order to show: what's on and what's next, then a few finished sets only while there's room. */
export function visibleLineup(lineup: DisplayEntry[], max = 8): DisplayEntry[] {
  const live = lineup.filter((entry) => entry.state !== 'done');
  const done = lineup.filter((entry) => entry.state === 'done');
  return [...done.slice(Math.max(0, done.length - Math.max(0, max - live.length))), ...live].slice(0, max);
}
