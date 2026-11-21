// Upcoming events' full-screen posters on a venue's TV, in the loop between looks at the lineup, taking turns with the
// slogan slides (rotation.ts). Velvet decides which events and words (staff-kit MarqueeEventPoster) and sends them to
// the cast receiver as `posters`; this keeps only what's safe to draw: words as text, https pictures, and codes to
// hotmess.social.

export interface EventPoster {
  id: string;
  name: string;
  /** "Tonight · 9 PM", "Tomorrow · 9:30 PM" or "Fri, Dec 5 · 9 PM", at the venue. */
  when: string;
  /** "with Anya · Darcy", or "". */
  billing: string;
  /** "Free" or "$10 cover"; null for the venue's usual. */
  cover: string | null;
  /** Its banner, https only. */
  image: string | null;
  /** Its page on hotmess.social, for the QR code. */
  link: string;
}

/** How many posters a TV takes turns with, as Velvet sends at most. */
export const MAX_POSTERS = 6;

function text(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/** The posters in a cast message, cleaned: anything malformed is left out. */
export function eventPosters(value: unknown): EventPoster[] {
  if (!Array.isArray(value)) return [];
  const posters: EventPoster[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const id = text(r.id, 64);
    const name = text(r.name);
    if (!id || !name) continue;
    const image = text(r.image, 2000);
    const link = text(r.link, 2000);
    posters.push({
      id,
      name,
      when: text(r.when, 80),
      billing: text(r.billing),
      cover: text(r.cover, 40) || null,
      image: image.startsWith('https://') ? image : null,
      link: link.startsWith('https://hotmess.social/') ? link : `https://hotmess.social/events/${encodeURIComponent(id)}`,
    });
    if (posters.length === MAX_POSTERS) break;
  }
  return posters;
}

/** The poster after the one last shown, soonest first and round again; null with none. */
export function nextPoster(posters: EventPoster[], lastShown: string | null): EventPoster | null {
  if (!posters.length) return null;
  const index = lastShown ? posters.findIndex((p) => p.id === lastShown) : -1;
  return posters[(index + 1) % posters.length];
}

/** "Tonight" for tonight's events, else "Coming up". */
export function posterKicker(poster: EventPoster): string {
  return poster.when.startsWith('Tonight') ? 'Tonight' : 'Coming up';
}

/** One of PublicTonight's `upcoming` events, as venueDisplay.ts reads it. */
export interface UpcomingEvent {
  id: string;
  name: string;
  startAt: string | null;
  night: string | null;
  image: string | null;
  people: string[];
  coverCents: number | null;
  /** A sliding-scale cover's least and most (coverCents is then the suggested amount). */
  coverMinCents?: number | null;
  coverMaxCents?: number | null;
}

function nextDay(night: string): string {
  const date = new Date(`${night}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function dollars(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

/** "Free", "$10 cover", or a sliding scale's "$5–$30 cover, pay what you can", as Velvet words it. */
export function coverLine(event: Pick<UpcomingEvent, 'coverCents' | 'coverMinCents' | 'coverMaxCents'>): string | null {
  if (event.coverCents == null) return null;
  if (event.coverCents === 0) return 'Free';
  if (event.coverMinCents != null && event.coverMaxCents != null) {
    return `${dollars(event.coverMinCents)}–${dollars(event.coverMaxCents)} cover, pay what you can`;
  }
  return `${dollars(event.coverCents)} cover`;
}

/** "Tonight · 9 PM", "Tomorrow · 9:30 PM" or "Fri, Dec 5 · 9 PM", at the venue, as Velvet words it. */
export function posterWhen(event: UpcomingEvent, tonight: string, zone: string): string {
  if (!event.startAt) return '';
  const start = new Date(event.startAt);
  if (Number.isNaN(start.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone }).formatToParts(start);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const period = parts.find((p) => p.type === 'dayPeriod')?.value ?? '';
  const time = `${hour}${minute === '00' ? '' : `:${minute}`} ${period}`.trim();
  let day: string;
  if (event.night === tonight) day = 'Tonight';
  else if (tonight && event.night === nextDay(tonight)) day = 'Tomorrow';
  else day = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: zone }).format(start);
  return `${day} · ${time}`;
}

/** The web sign's posters from PublicTonight's `upcoming`, worded as Velvet words them. */
export function postersFromTonight(upcoming: UpcomingEvent[], tonight: string, zone: string): EventPoster[] {
  return eventPosters(upcoming.map((event) => ({
    id: event.id,
    name: event.name,
    when: posterWhen(event, tonight, zone),
    billing: event.people.length ? `with ${event.people.slice(0, 4).join(' · ')}` : '',
    cover: coverLine(event),
    image: event.image,
    link: `https://hotmess.social/events/${encodeURIComponent(event.id)}`,
  })));
}
