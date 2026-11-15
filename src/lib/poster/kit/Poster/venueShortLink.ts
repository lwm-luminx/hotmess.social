// A venue's short link, <web app>/v/<code> (VenueShortLink on the API; hotmess.social src/lib/venueShortLink.ts): the
// top 47 bits of the venue's UUID in base62, eight characters, nothing stored. It never expires and scans from across
// a room, so it's what a Hot Mess venue's poster puts in its QR code, the same as the hotmess.social poster builder.
// Only Hot Mess's web app (hotmess.social) answers /v/<code>, so other audiences keep the signed share link.
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** The venue's eight-character code, or null for an ID that isn't a UUID. */
export function venueShortCode(id: string): string | null {
    const hex = id.replace(/-/g, '')
    if (!/^[0-9a-f]{32}$/i.test(hex)) return null
    // The top 48 bits fit a JavaScript number exactly; halving them leaves the top 47.
    let value = Math.floor(parseInt(hex.slice(0, 12), 16) / 2)
    let code = ''
    for (let i = 0; i < 8; i++) {
        code = ALPHABET[value % 62] + code
        value = Math.floor(value / 62)
    }
    return code
}

/** `<webUrl>/v/<code>` for the venue, or null for an ID that isn't a UUID. */
export function venueShortLink(webUrl: string, id: string): string | null {
    const code = venueShortCode(id)
    return code ? `${webUrl.replace(/\/+$/, '')}/v/${code}` : null
}

/** Whether the audience's web app answers short links: only Hot Mess's does. */
export const hasShortLinks = (preset: string) => preset === 'hot_mess'
