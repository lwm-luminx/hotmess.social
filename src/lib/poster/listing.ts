// What a poster says about the venue or event it was made for, from the API's listing (src/lib/api.ts). Pure, so it
// tests with node --test.
import type { PosterEvent, PosterVenue } from '../api.ts';
import { eventTime } from '../../sdk/format.ts';
import type { PosterEvent as PosterLines } from './render.ts';

export type ListingKind = 'venue' | 'event';
export interface ListingRef { kind: ListingKind; id: string }

/** A search result or the poster's subject: its kind, and the lines the picker and the poster show. */
export interface PosterListing extends ListingRef { name: string; place: string; when: string }

function joined(...parts: (string | null | undefined)[]): string {
  return parts.map((p) => p?.trim()).filter(Boolean).join(' · ');
}

export function venueListing(venue: PosterVenue): PosterListing {
  return {
    kind: 'venue', id: venue.id, name: venue.name?.trim() || 'Venue',
    place: venue.profile?.address?.trim() || venue.locale?.name?.trim() || '', when: '',
  };
}

export function eventListing(event: PosterEvent, locale?: string, timeZone?: string): PosterListing {
  const venue = event.venue?.venue;
  return {
    kind: 'event', id: event.id, name: event.name?.trim() || 'Event',
    place: joined(venue?.name ?? event.venue?.name, venue?.locale?.name), when: eventTime(event, locale, timeZone),
  };
}

/** The poster's night, venue and when lines, and its QR link: the share link, else the download page. */
export function posterLines(listing: PosterListing | null, link: string | null): PosterLines {
  if (!listing) return { night: '', venue: '', when: '', link: '' };
  return { night: listing.name, venue: listing.place, when: listing.when, link: link ?? '' };
}

/** The listing a poster's address names (?venue=<id> or ?event=<id>), if any. */
export function listingFromQuery(q: URLSearchParams): ListingRef | null {
  const uuid = /^[0-9a-f-]{36}$/i;
  for (const kind of ['event', 'venue'] as const) {
    const id = q.get(kind);
    if (id && uuid.test(id)) return { kind, id };
  }
  return null;
}
