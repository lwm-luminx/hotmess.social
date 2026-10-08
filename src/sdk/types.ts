// AudienceKit's shapes, as src/lib/api.ts asks GraphQL for them (fields aliased to snake_case).
// Fields are optional wherever the API leaves them out or sends null.

export interface VenueReference {
  id: string;
  name: string;
  /** The venue's Facebook Page ID, or "" when it has none. */
  facebook_id?: string | number | null;
  /** The venue's Facebook Page picture. */
  photo_url?: string | null;
  /** A photo of the place itself; most venues have this rather than a Page picture. */
  hero_url?: string | null;
}

export interface Venue extends VenueReference {
  address?: string | null;
  phone?: string | null;
  hero_banner_url?: string | null;
  /** Metres from where the request was made, on Now. */
  distance?: number | null;
  description?: string | null;
  friend_count?: number;
  cover_photos?: { url: string }[];
}

export interface PersonReference {
  id: string;
  name: string;
  facebook_id?: string | number | null;
  photo_url?: string | null;
  role?: string;
}

export interface SocialLink {
  id: string;
  provider: string;
  handle?: string | null;
  url: string;
}

export interface Track {
  id: string;
  title: string;
  released_at?: string;
  provider?: string;
  provider_url?: string | null;
  stream_url?: string | null;
  artwork_url?: string | null;
}

export interface Person extends PersonReference {
  cover_url?: string | null;
  social_links?: SocialLink[];
  tracks?: Track[];
  events?: Event[];
}

export interface Event {
  id: string;
  name: string;
  start_at: string;
  end_at?: string | null;
  facebook_id?: string | number | null;
  cover_photo_url?: string | null;
  rsvp?: 'going' | 'interested' | 'not_going' | 'unsure' | string;
  /** Set when the event has no venue yet (an occurrence of a series still to be announced). */
  venue_name?: string | null;
  venue?: Venue | null;
  /** The host, on event lists. */
  person?: PersonReference | null;
  /** Everyone on the bill, on an event's own page. */
  people?: PersonReference[];
}

export interface Friend {
  id: string;
  name: string;
  facebook_id?: string | number | null;
}

export interface Now {
  title?: string;
  image_url?: string | null;
  locale?: { id: string; name: string };
  /** Set when you're at a venue. */
  venue?: Venue;
  /** The locale's venues, nearest first, when you're not at one. */
  venues?: Venue[];
  events?: Event[];
  friends?: Friend[];
}
