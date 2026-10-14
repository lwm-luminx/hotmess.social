import type { Event, Person, PersonReference, VenueReference } from './types';

/** The photo to show for a venue: its Page picture, else a photo of the place. */
export function venuePhoto(venue: VenueReference | null | undefined): string | undefined {
  return venue?.photo_url || venue?.hero_url || undefined;
}

/** The wide photo for a venue's header: the place itself, else its Page picture. */
export function venueHero(venue: VenueReference | null | undefined): string | undefined {
  return venue?.hero_url || venue?.photo_url || undefined;
}

/** The photo to show for a person: their avatar photo, else their banner photo. */
export function personPhoto(person: PersonReference | Person | null | undefined): string | undefined {
  if (!person) return undefined;
  return person.photo_url || (person && 'banner_url' in person ? (person as Person).banner_url : undefined) || undefined;
}

export type EventPhotoPriority = 'standard' | 'venue-first' | 'person-first';

/**
 * Most events have no banner of their own (and Now never sends one).
 * In a person page, falls back to venue, then person ('venue-first').
 * In a venue view, falls back to person, then venue ('person-first').
 * This prevents lists from showing the same photo repeatedly.
 */
export function eventPhoto(
  event: Event,
  priority: EventPhotoPriority = 'standard',
  fallbackVenue?: VenueReference | null,
  fallbackPerson?: PersonReference | Person | null,
): string | undefined {
  const venueBg = venuePhoto(event.venue) || venuePhoto(fallbackVenue);
  const personBg = personPhoto(event.person) || personPhoto(fallbackPerson);
  if (priority === 'venue-first') {
    return event.banner_url || venueBg || personBg;
  }
  if (priority === 'person-first') {
    return event.banner_url || personBg || venueBg;
  }
  return event.banner_url || venueBg || personBg;
}

/** Where an event is, by name, even before its venue is announced. */
export function eventPlace(event: Event): string | undefined {
  return event.venue?.name || event.venue_name || undefined;
}

/** A Facebook ID the API sent, or undefined for "", 0, null and anything that isn't one. */
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

/** "Fri, Oct 9 · 8:00 PM – 11:00 PM", or with the end date when it ends on another day. */
export function eventTime(event: Pick<Event, 'start_at' | 'end_at'>, locale?: string, timeZone?: string): string {
  const start = new Date(event.start_at);
  const day = start.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone });
  const time = (date: Date) => date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone });
  if (!event.end_at) return `${day} · ${time(start)}`;

  const end = new Date(event.end_at);
  const endDay = end.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone });
  // Nights out run past midnight; only name the end date when the event runs longer than a day.
  const sameNight = end.getTime() - start.getTime() < 24 * 60 * 60 * 1000;
  return sameNight || endDay === day
    ? `${day} · ${time(start)} – ${time(end)}`
    : `${day} ${time(start)} – ${endDay} ${time(end)}`;
}

/** A short date badge for an event card: { month: "OCT", day: "9" }. */
export function dateBadge(iso: string, locale?: string, timeZone?: string): { month: string; day: string } {
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
export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]!.toUpperCase()).join('');
}

/** A human name for a social link's provider. */
export function providerName(provider: string): string {
  const names: Record<string, string> = {
    facebook: 'Facebook', instagram: 'Instagram', soundcloud: 'SoundCloud', spotify: 'Spotify',
    tiktok: 'TikTok', twitter: 'X', x: 'X', youtube: 'YouTube', mixcloud: 'Mixcloud', website: 'Website',
    podcast_rss: 'RSS', apple_podcasts: 'Apple Podcasts', apple_music: 'Apple Music',
  };
  return names[provider.toLowerCase()] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}
