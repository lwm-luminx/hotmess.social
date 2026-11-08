// A venue's short link, https://hotmess.social/v/<code> (audience_kit_api VenueShortLink): the top 47 bits of the
// venue's UUID in base62, eight characters, nothing stored. /v/<code> redirects to the venue's room in Hot Mess, or a
// phone without the app to its store. It never expires and scans from across a room, so it's what a venue's printed
// poster and Velvet's TV (src/pages/cast/velvet.astro, which inlines a copy) put in their QR codes. Pure, so it tests
// with node --test.
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The venue's eight-character code, or null for an ID that isn't a UUID. */
export function venueShortCode(id: string): string | null {
  const hex = id.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
  // The top 48 bits fit a JavaScript number exactly; halving them leaves the top 47.
  let value = Math.floor(parseInt(hex.slice(0, 12), 16) / 2);
  let code = '';
  for (let i = 0; i < 8; i++) { code = ALPHABET[value % 62] + code; value = Math.floor(value / 62); }
  return code;
}

/** https://hotmess.social/v/<code> for the venue, or null for an ID that isn't a UUID. */
export function venueShortLink(id: string): string | null {
  const code = venueShortCode(id);
  return code ? `https://hotmess.social/v/${code}` : null;
}
