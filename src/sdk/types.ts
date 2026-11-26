// AudienceKit's shapes, exactly as the SDK's website documents select them from the consumer GraphQL endpoint
// (audience-kit-sdk node/src/website/models.ts, `Website` in the audience-kit package). The SDK validates those
// documents against the API's schema in its CI, so a renamed field fails there.
import type { Credential, Website } from 'audience-kit';

export type PhotoURL = Website.PhotoURL;
export type RSVPState = Website.RSVPState;
export type Connection<T> = Website.Connection<T>;
export type ListingProfile = Website.ListingProfile;
export type VenueReference = Website.VenueReference;
export type Venue = Website.Venue;
export type PersonReference = Website.PersonReference;
export type SocialLink = Website.SocialLink;
export type Track = Website.Track;
export type Person = Website.Person;
export type Event = Website.Event;
export type Friend = Website.Friend;
export type FriendVenue = Website.FriendVenue;
export type Locale = Website.Locale;
export type Now = Website.Now;
export type Post = Website.Post;
export type PosterVenue = Website.PosterVenue;
export type PosterSeries = Website.PosterSeries;
export type PosterEvent = Website.PosterEvent;
export type SignInMethods = Website.SignInMethods;

/**
 * The token JSON every sign-in answers (POST /v1/token and friends; doc/TOKENS.md). Clients read these fields instead
 * of decoding the JWT.
 */
export type TokenResponse = Credential;
