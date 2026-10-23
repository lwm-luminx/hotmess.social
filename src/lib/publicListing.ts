// This is the complete public contract. Never serialize a GraphQL record into an island's props.
export interface PublicListing {
  kind: 'venue' | 'event' | 'post';
  id: string;
  path: string;
  visibility?: 'community' | 'public';
  start_at?: string;
  end_at?: string;
  venue_name?: string;
  ticket_url?: string;
  image?: string;
  is_canceled?: boolean;
  cover_cents?: number;
  title: string;
  description: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  // A Public post (title is its poster's name, description its summary).
  body?: string;
  created_at?: string;
  edited?: boolean;
  poster?: { kind: 'venue' | 'person'; id: string; name: string; path: string };
  acting_person_name?: string;
  photos?: { url: string; alt_text?: string }[];
  event?: { id: string; name: string; path: string; start_at?: string };
}

const UUID = /^[0-9a-f-]{36}$/;
const PATHS = { venue: 'venues', event: 'events', post: 'posts', person: 'people' } as const;
const webURL = (value: unknown): value is string => typeof value === 'string' && /^https?:\/\//i.test(value);

// A Public post's own fields. Paths are rebuilt here from IDs, never taken from the API.
function postFields(v: Record<string, unknown>, result: PublicListing) {
  if (typeof v.body === 'string') result.body = v.body;
  if (typeof v.created_at === 'string') result.created_at = v.created_at;
  if (typeof v.edited === 'boolean') result.edited = v.edited;
  if (typeof v.acting_person_name === 'string') result.acting_person_name = v.acting_person_name;
  const poster = v.poster as Record<string, unknown> | undefined;
  if (poster && (poster.kind === 'venue' || poster.kind === 'person') && typeof poster.id === 'string' &&
      UUID.test(poster.id) && typeof poster.name === 'string') {
    result.poster = { kind: poster.kind, id: poster.id, name: poster.name, path: `/${PATHS[poster.kind]}/${poster.id}` };
  }
  if (Array.isArray(v.photos)) {
    result.photos = v.photos.slice(0, 4).flatMap((photo: Record<string, unknown> | null) => {
      if (!photo || !webURL(photo.url)) return [];
      return [typeof photo.alt_text === 'string' ? { url: photo.url, alt_text: photo.alt_text } : { url: photo.url }];
    });
  }
  const event = v.event as Record<string, unknown> | undefined;
  if (event && typeof event.id === 'string' && UUID.test(event.id) && typeof event.name === 'string') {
    result.event = { id: event.id, name: event.name, path: `/events/${event.id}` };
    if (typeof event.start_at === 'string') result.event.start_at = event.start_at;
  }
}

export function publicListing(value: unknown): PublicListing {
  const v = value as Record<string, unknown>;
  if (!v || !['venue', 'event', 'post'].includes(String(v.kind)) || typeof v.id !== 'string' ||
      !UUID.test(v.id) || typeof v.title !== 'string' || typeof v.description !== 'string') {
    throw new Error('Invalid public listing');
  }
  const kind = v.kind as PublicListing['kind'];
  const result: PublicListing = { kind, id: v.id, path: `/${PATHS[kind]}/${v.id}`, title: v.title, description: v.description };
  if (kind === 'venue') {
    for (const field of ['address', 'phone'] as const) if (typeof v[field] === 'string') result[field] = v[field];
    if (typeof v.website === 'string' && /^https?:\/\//i.test(v.website)) result.website = v.website;
  }
  if (v.visibility === 'community' || v.visibility === 'public') result.visibility = v.visibility;
  if (v.visibility === 'public') {
    for (const field of ['start_at', 'end_at', 'venue_name', 'address'] as const) {
      if (typeof v[field] === 'string') result[field] = v[field];
    }
    for (const field of ['ticket_url', 'image'] as const) {
      if (typeof v[field] === 'string' && /^https?:\/\//i.test(v[field])) result[field] = v[field];
    }
    if (typeof v.is_canceled === 'boolean') result.is_canceled = v.is_canceled;
    if (typeof v.cover_cents === 'number' && Number.isInteger(v.cover_cents) && v.cover_cents >= 0) result.cover_cents = v.cover_cents;
    if (kind === 'post') postFields(v, result);
  }
  return result;
}
