// Pure helpers the components share. No DOM or React, so they test with node --test.
import type { Connection, Event, VenueReference } from './types';

/** The items of a connection the document selected `nodes` from; a missing or null one is empty. */
export function nodes<T>(connection: Connection<T> | null | undefined): T[] {
  return (connection?.nodes ?? []).filter((node): node is T => node != null);
}

/** The photo to show for a venue in a list: its own photo of the place, else its banner. */
export function venuePhoto(venue: VenueReference | null | undefined): string | undefined {
  return venue?.photoUrl || venue?.bannerUrl || undefined;
}

/** The wide photo for a venue's header: its banner, else its own photo. */
export function venueHero(venue: VenueReference | null | undefined): string | undefined {
  return venue?.bannerUrl || venue?.photoUrl || undefined;
}

/** Most events have no banner of their own, so fall back to the venue's photo. */
export function eventPhoto(event: Event): string | undefined {
  return event.bannerUrl || venuePhoto(event.venue?.venue);
}

/** Where an event is, by name: its venue's, else what its venue mixin calls the place. */
export function eventPlace(event: Event): string | undefined {
  return event.venue?.venue?.name || event.venue?.name || undefined;
}

/** The first act on an event's bill, whom lists name as its host ("with Aurora"). */
export function eventHost(event: Event) {
  return nodes(event.people?.lineup)[0];
}

/** A Facebook ID the API sent, or undefined for "", "0", null and anything that isn't one. */
export function facebookID(id: string | number | null | undefined): string | undefined {
  const value = id == null ? '' : String(id);
  return /^[1-9][0-9]*$/.test(value) ? value : undefined;
}

/** facebook.com links for a Page (venues, people) or an event. */
export function facebookURL(id: string | number | null | undefined, kind: 'page' | 'event' = 'page'): string | undefined {
  const value = facebookID(id);
  if (!value) return undefined;
  return kind === 'event' ? `https://www.facebook.com/events/${value}/` : `https://www.facebook.com/${value}`;
}

/** "Fri, Oct 9 · 8:00 PM – 11:00 PM", or with the end date when it ends on another day; "" without a start. */
export function eventTime(event: Pick<Event, 'startAt' | 'endAt'>, locale?: string, timeZone?: string): string {
  if (!event.startAt) return '';
  const start = new Date(event.startAt);
  const day = start.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone });
  const time = (date: Date) => date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone });
  if (!event.endAt) return `${day} · ${time(start)}`;

  const end = new Date(event.endAt);
  const endDay = end.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone });
  // Nights out run past midnight; only name the end date when the event runs longer than a day.
  const sameNight = end.getTime() - start.getTime() < 24 * 60 * 60 * 1000;
  return sameNight || endDay === day
    ? `${day} · ${time(start)} – ${time(end)}`
    : `${day} ${time(start)} – ${endDay} ${time(end)}`;
}

/** A short date badge for an event card: { month: "OCT", day: "9" }; blank without a date. */
export function dateBadge(iso: string | null | undefined, locale?: string, timeZone?: string): { month: string; day: string } {
  if (!iso) return { month: '', day: '' };
  const date = new Date(iso);
  return {
    month: date.toLocaleDateString(locale, { month: 'short', timeZone }).toUpperCase(),
    day: date.toLocaleDateString(locale, { day: 'numeric', timeZone }),
  };
}

/** Distance in metres as "350 ft" or "2.4 mi", the way the iOS app shows it. */
export function distance(metres: number | null | undefined): string | undefined {
  if (metres == null || !Number.isFinite(metres)) return undefined;
  const feet = metres * 3.28084;
  if (feet < 1000) return `${Math.round(feet / 10) * 10} ft`;
  const miles = metres / 1609.344;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

/** Initials for a placeholder avatar: "Rick Mark" -> "RM". */
export function initials(name: string | null | undefined): string {
  return (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]!.toUpperCase()).join('');
}

/** A human name for a social link's provider. */
export function providerName(provider: string): string {
  const names: Record<string, string> = {
    facebook: 'Facebook', instagram: 'Instagram', soundcloud: 'SoundCloud', spotify: 'Spotify',
    apple_music: 'Apple Music', tiktok: 'TikTok', twitter: 'X', x: 'X', threads: 'Threads', bluesky: 'Bluesky',
    youtube: 'YouTube', mixcloud: 'Mixcloud', bandcamp: 'Bandcamp', cashapp: 'Cash App', venmo: 'Venmo',
    website: 'Website', link: 'Website',
  };
  return names[provider.toLowerCase()] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}
