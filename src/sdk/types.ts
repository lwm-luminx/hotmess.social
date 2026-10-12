// AudienceKit's shapes, exactly as src/lib/api.ts selects them from the consumer GraphQL endpoint
// (POST /v1/audience/:id/graphql). The ground truth is api/schema.graphql in
// audience-kit/audience-kit; these types are hand-aligned with it, field for field, and the
// GraphQL documents check in CI (.github/workflows/graphql-documents.yml) fails when a document
// no longer matches the schema. Fields are nullable here wherever the schema leaves them nullable,
// and optional only where a document may not select them.

/** An absolute image URL. Null, never "", when there is no image (scalar PhotoURL). */
export type PhotoURL = string;

/** The signed-in user's answer to an event (enum RSVPState). */
export type RSVPState = 'ATTENDING' | 'MAYBE' | 'DECLINED' | 'UNSURE';

/** A Relay connection, as the documents select it: its nodes only. */
export interface Connection<T> {
  nodes: (T | null)[] | null;
}

/** The parts of a venue's or person's listing profile (IListingProfile) the site reads. */
export interface ListingProfile {
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  /** Its Facebook Page's ID (a string: Page IDs overflow Int), or null without a Page. */
  facebook?: { facebookId: string | null };
  socialLinks?: Connection<SocialLink>;
}

export interface VenueReference {
  id: string;
  name: string | null;
  /** Its own photo of the place. */
  photoUrl?: PhotoURL | null;
  /** Its first banner image, else its own photo, else its Facebook Page's cover photo. */
  bannerUrl?: PhotoURL | null;
  profile?: ListingProfile;
}

export interface Venue extends VenueReference {
  description?: string | null;
  /** Metres from where the request was made, on Now. */
  distance?: number | null;
  friends?: { list: Connection<Friend> };
  events?: { upcoming: Connection<Event> };
}

export interface PersonReference {
  id: string;
  name: string | null;
  avatarUrl?: PhotoURL | null;
  profile?: ListingProfile;
}

export interface SocialLink {
  id: string;
  provider: string;
  handle: string;
  url: string | null;
}

export interface Track {
  id: string;
  title: string | null;
  provider?: string | null;
  providerUrl?: string | null;
  artworkUrl?: string | null;
  releasedAt?: string | null;
}

export interface Person extends PersonReference {
  bannerUrl?: PhotoURL | null;
  music?: { links: Connection<SocialLink>; tracks: Connection<Track> };
  events?: { upcoming: Connection<Event> };
}

export interface Event {
  id: string;
  name: string | null;
  startAt: string | null;
  endAt: string | null;
  facebookId: string | null;
  bannerUrl: PhotoURL | null;
  rsvp?: { mine: RSVPState };
  /** Its venue mixin: the venue's name (or "To be announced") and the venue itself while it has one. */
  venue: { name: string; venue: Venue | null };
  /** Its people mixin: who is hosting or playing it. */
  people?: { lineup: Connection<PersonReference> };
}

export interface Friend {
  id: string;
  name: string | null;
  avatarUrl: PhotoURL | null;
  facebookId?: string | null;
}

export interface FriendVenue {
  venue: { id: string };
  friendCount: number;
}

export interface Locale {
  id: string;
  name: string | null;
  label?: string | null;
  bannerUrl?: PhotoURL | null;
  events?: { upcoming: Connection<Event> };
  friends?: { list: Connection<Friend>; venues: Connection<FriendVenue> };
}

/** What reportLocation answers (LocationReportPayload): where you are, and what's around it. */
export interface Now {
  /** The venue you're at, when you're at one. */
  venue: Venue | null;
  /** The locale you're in, or the closest one. */
  locale: Locale | null;
  /** The locale's venues, nearest first, when you're not at one. */
  nearbyVenues: Venue[] | null;
}

/**
 * The token JSON every sign-in answers (POST /v1/token and friends; doc/TOKENS.md). Clients read
 * these fields instead of decoding the JWT.
 */
export interface TokenResponse {
  token: string;
  userId: string | null;
  audienceId: string | null;
  role: 'member' | 'listing' | 'admin' | 'venue_device' | 'service';
  /** The absolute URL of the widest GraphQL endpoint the token is for. */
  endpoint: string;
  venueDeviceId: string | null;
  expiresAt: string | null;
}
