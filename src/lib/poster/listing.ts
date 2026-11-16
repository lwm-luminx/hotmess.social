// What a poster says about the venue or event it was made for, from the API's listing (src/lib/api.ts). Pure, so it
// tests with node --test.
import type { PosterEvent, PosterSeries, PosterVenue } from '../api.ts';
import { eventTime } from '../../sdk/format.ts';
import type { PosterEvent as PosterLines } from './render.ts';

/** A venue, a one-off event, or a recurring series (as a whole: a poster never names one date of a series). */
export type ListingKind = 'venue' | 'event' | 'series';
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

/** "21:00" as "9 PM", "21:30" as "9:30 PM"; "" for no time. */
export function clockTime(hhmm: string): string {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  const h = Number(m[1]), min = m[2];
  const hour = h % 12 || 12;
  return `${hour}${min === '00' ? '' : `:${min}`} ${h < 12 ? 'AM' : 'PM'}`;
}

/** A series as a poster names it: its name, its venue, and its rule with its start time ("Every week on Thursday · 9 PM"). */
export function seriesListing(series: PosterSeries, venue?: PosterEvent['venue']): PosterListing {
  const place = venue?.venue;
  return {
    kind: 'series', id: series.id, name: series.name?.trim() || 'Event',
    place: joined(place?.name ?? venue?.name, place?.locale?.name),
    when: joined(series.recurrenceText, clockTime(series.startTime)),
  };
}

/**
 * A venue's nights for the picker: each series once (however many of its dates are coming), then the one-off events,
 * each list soonest first. A date of a series is only ever offered as its series.
 */
export function nightsOf(events: PosterEvent[], locale?: string, timeZone?: string): { series: PosterListing[]; oneOffs: PosterListing[] } {
  const series: PosterListing[] = [];
  const seen = new Set<string>();
  const oneOffs: PosterListing[] = [];
  const sorted = [...events].sort((a, b) => (a.startAt ?? '').localeCompare(b.startAt ?? ''));
  for (const event of sorted) {
    if (event.eventSeries) {
      if (seen.has(event.eventSeries.id)) continue;
      seen.add(event.eventSeries.id);
      series.push(seriesListing(event.eventSeries, event.venue));
    } else oneOffs.push(eventListing(event, locale, timeZone));
  }
  return { series, oneOffs };
}

/** The poster's night, venue and when lines, and its QR link: the share link, else the download page. */
export function posterLines(listing: PosterListing | null, link: string | null): PosterLines {
  if (!listing) return { night: '', venue: '', when: '', link: '' };
  return { night: listing.name, venue: listing.place, when: listing.when, link: link ?? '' };
}

/** The listing a poster's address names (?series=<id>, ?event=<id> or ?venue=<id>), if any. */
export function listingFromQuery(q: URLSearchParams): ListingRef | null {
  const uuid = /^[0-9a-f-]{36}$/i;
  for (const kind of ['series', 'event', 'venue'] as const) {
    const id = q.get(kind);
    if (id && uuid.test(id)) return { kind, id };
  }
  return null;
}
