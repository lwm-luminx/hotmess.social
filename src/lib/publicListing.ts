// This is the complete public contract. Never serialize a GraphQL record into an island's props.
export interface PublicListing {
  kind: 'venue' | 'event';
  id: string;
  path: string;
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
  return result;
}
