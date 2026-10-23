// This is the complete public contract. Never serialize a GraphQL record into an island's props.
export interface PublicListing {
  kind: 'venue' | 'event';
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
}

export function publicListing(value: unknown): PublicListing {
  const v = value as Record<string, unknown>;
  if (!v || !['venue', 'event'].includes(String(v.kind)) || typeof v.id !== 'string' ||
      !/^[0-9a-f-]{36}$/.test(v.id) || typeof v.title !== 'string' || typeof v.description !== 'string') {
    throw new Error('Invalid public listing');
  }
  const kind = v.kind as PublicListing['kind'];
  const result: PublicListing = { kind, id: v.id, path: `/${kind === 'venue' ? 'venues' : 'events'}/${v.id}`,
    title: v.title, description: v.description };
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
  }
  return result;
}
