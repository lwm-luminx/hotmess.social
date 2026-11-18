// The API's preview of a share link (GET /v1/share, audience_kit_api ShareCard): what a link to a venue, event or
// person shows anyone, signed in or not. It needs no site credential, so link previews keep working when the public
// listings can't be read, and it's the only preview a person's page has (people have no public listing).

export interface ShareCard {
  kind: 'venue' | 'event' | 'person';
  title: string;
  description: string;
  siteName: string;
  image?: string;
  /** "community" for a performer only signed-in people see: the card then names no one. */
  visibility?: string;
  address?: string;
  startAt?: string;
  venueName?: string;
  isCanceled?: boolean;
}

const KINDS = ['venue', 'event', 'person'] as const;
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const https = (value: unknown) => (typeof value === 'string' && value.startsWith('https://') ? value : undefined);
const record = (value: unknown) => (value && typeof value === 'object' ? value as Record<string, unknown> : {});

/** The card from the API's JSON, or null when it isn't one. */
export function shareCard(json: unknown): ShareCard | null {
  const body = record(json);
  const kind = KINDS.find((k) => k === body.kind);
  const title = text(body.title);
  if (!kind || !title) return null;
  const venue = record(body.venue);
  const event = record(body.event);
  const card: ShareCard = { kind, title, description: text(body.description), siteName: text(body.site_name) || 'Hot Mess' };
  const image = https(record(body.image).url);
  if (image) card.image = image;
  if (text(body.visibility)) card.visibility = text(body.visibility);
  const address = text(venue.address) || text(event.address);
  if (address) card.address = address;
  if (text(event.start_at)) card.startAt = text(event.start_at);
  if (text(event.venue_name)) card.venueName = text(event.venue_name);
  if (event.is_canceled === true) card.isCanceled = true;
  return card;
}
