import type { PublicListing } from './publicListing';

// What a link preview (iMessage, Facebook, WhatsApp, Slack) shows for a venue or event page. Most venues have no
// description of their own, so the preview falls back to where it is, or when and where for an event, rather than an
// empty line.

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function previewDescription(record: PublicListing | null | undefined): string {
  if (!record) return 'Sign in to see more details.';
  if (record.description.trim()) return record.description;

  if (record.kind === 'venue') return record.address ? `${record.title} · ${record.address}` : `${record.title} on Hot Mess`;
  if (record.kind === 'event') {
    const parts = [record.is_canceled ? 'Canceled' : '', when(record.start_at), record.venue_name ? `at ${record.venue_name}` : '']
      .filter(Boolean);
    return parts.length ? parts.join(' · ').replace(' · at ', ' at ') : `${record.title} on Hot Mess`;
  }
  return 'Sign in to see more details.';
}

/** A Public venue's or event's own photo; Community listings carry none. */
export function previewImage(record: PublicListing | null | undefined): string | undefined {
  if (!record || record.visibility !== 'public') return undefined;
  if (record.kind === 'post') return record.photos?.[0]?.url ?? record.image;
  return record.image;
}

/**
 * "Fri, Oct 17 · 9 PM", read from the local time in the API's ISO string (2026-10-17T21:00:00-07:00), so the server's
 * own time zone never shifts the day.
 */
export function when(iso: string | undefined): string {
  const match = iso?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return '';
  const [, year, month, day, hour, minute] = match.map(Number);
  const weekday = DAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const h = hour % 12 || 12;
  const time = minute ? `${h}:${String(minute).padStart(2, '0')}` : `${h}`;
  return `${weekday}, ${MONTHS[month - 1]} ${day} · ${time} ${hour < 12 ? 'AM' : 'PM'}`;
}
