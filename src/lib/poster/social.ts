// The venue's social media profiles for the "follow us" slide in a TV's poster loop (rotation.ts). Velvet sends them to
// the cast receiver as `social`, and the web sign reads them from the API's tonight (PublicTonight `social`); this
// keeps only what's safe to draw: known social networks, https profile links, handles as text. Never tip links.

export interface SocialProfile {
  provider: string;
  /** The network's name, "Instagram". */
  network: string;
  /** The handle as people search for it, "@kremwerk". */
  handle: string;
  /** The profile, https only, for the QR code. */
  url: string;
}

/** The networks a TV shows, in order, with their names; anything else (tip links included) is left out. */
const NETWORKS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  x: 'X',
  threads: 'Threads',
  bluesky: 'Bluesky',
  youtube: 'YouTube',
  linktree: 'Linktree',
  discord: 'Discord',
};
const ORDER = Object.keys(NETWORKS);

/** How many profiles the slide shows, each with its own code. */
export const MAX_SOCIAL = 4;

/** Networks whose handles people type with an @. */
const AT = new Set(['instagram', 'tiktok', 'x', 'threads', 'bluesky']);

export function displayHandle(provider: string, handle: string): string {
  const bare = handle.trim().replace(/^@+/, '');
  if (!bare) return '';
  if (AT.has(provider)) return `@${bare}`;
  if (provider === 'youtube' && !bare.includes('/')) return `@${bare}`;
  if (provider === 'linktree') return `linktr.ee/${bare}`;
  if (provider === 'discord') return `discord.gg/${bare}`;
  return bare;
}

/** The profiles in a message, cleaned: known networks, https links, one per network, in ORDER, at most MAX_SOCIAL. */
export function socialProfiles(value: unknown): SocialProfile[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const profiles: SocialProfile[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const given = typeof r.provider === 'string' ? r.provider.toLowerCase() : '';
    const provider = given === 'twitter' ? 'x' : given;
    const network = NETWORKS[provider];
    const url = typeof r.url === 'string' ? r.url.slice(0, 2000) : '';
    const handle = typeof r.handle === 'string' ? displayHandle(provider, r.handle.slice(0, 200)) : '';
    if (!network || !url.startsWith('https://') || !handle || seen.has(network)) continue;
    seen.add(network);
    profiles.push({ provider, network, handle, url });
  }
  return profiles.sort((a, b) => ORDER.indexOf(a.provider) - ORDER.indexOf(b.provider)).slice(0, MAX_SOCIAL);
}
