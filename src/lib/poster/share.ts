// Sharing a poster straight to social: each network's best size, a caption, and where the post is composed. Phones
// hand the picture and caption to the share sheet (navigator.share), which passes them to Instagram, Threads or any
// app; a computer downloads the picture, copies the caption and opens the network's composer with the text filled in
// (Instagram has no web composer, so it opens Instagram to upload). Pure, so it tests with node --test.
import { plainText, sloganText, type Slogan, type SloganLanguage } from './slogans.ts';
import type { FormatKey, PosterEvent } from './render.ts';

export type Network = 'instagram' | 'story' | 'x' | 'facebook' | 'threads' | 'bluesky';

export interface NetworkInfo {
  label: string;
  /** The sizes that suit it, best first; a poster in another size is shared in the first. */
  formats: FormatKey[];
  /** Its web composer with the text filled in, or null where there is none (Instagram). */
  compose: ((text: string, url: string) => string) | null;
  /** Where to upload by hand when it has no composer. */
  home?: string;
}

const q = encodeURIComponent;

export const NETWORKS: Record<Network, NetworkInfo> = {
  instagram: { label: 'Instagram post', formats: ['portrait', 'post'], compose: null, home: 'https://www.instagram.com/' },
  story: { label: 'Instagram story', formats: ['story'], compose: null, home: 'https://www.instagram.com/' },
  x: { label: 'X', formats: ['wide', 'post'], compose: (text, url) => `https://x.com/intent/post?text=${q(text)}${url ? `&url=${q(url)}` : ''}` },
  facebook: { label: 'Facebook', formats: ['portrait', 'wide', 'post'], compose: (_text, url) => `https://www.facebook.com/sharer/sharer.php?u=${q(url || DOWNLOAD)}` },
  threads: { label: 'Threads', formats: ['portrait', 'post'], compose: (text, url) => `https://www.threads.net/intent/post?text=${q(url ? `${text} ${url}` : text)}` },
  bluesky: { label: 'Bluesky', formats: ['wide', 'portrait', 'post'], compose: (text, url) => `https://bsky.app/intent/compose?text=${q(url ? `${text} ${url}` : text)}` },
};

const DOWNLOAD = 'https://hotmess.social/download';

/** The size a poster is shared to a network in: its own when that suits the network, else the network's best. */
export function shareFormat(network: Network, current: FormatKey): FormatKey {
  const formats = NETWORKS[network].formats;
  return formats.includes(current) ? current : formats[0];
}

/** The link a post carries: the poster's own (its venue or night in Hot Mess), else the app download page. */
export function shareLink(event: PosterEvent): string {
  return event.link.trim() || DOWNLOAD;
}

/**
 * The caption: the line, then the night (its name, when and where) when the poster is for one, then the hashtag.
 * The link goes in the composer's own field where it has one, else at the end.
 */
export function shareCaption(slogan: Slogan, event: PosterEvent, language: SloganLanguage = 'en'): string {
  const line = plainText(sloganText(slogan, language));
  const second = language === 'en-es' && slogan.es && slogan.es !== slogan.text ? plainText(slogan.es) : '';
  const night = [event.night, event.when, event.venue].map((s) => s.trim()).filter(Boolean).join(' · ');
  const tag = language === 'es' ? '#HotMess #NocheGay' : '#HotMess';
  return [line, second, night, tag].filter(Boolean).join('\n');
}

/** The composer to open for a network, or its home page to upload on, with the caption and link. */
export function composeUrl(network: Network, caption: string, link: string): string {
  const info = NETWORKS[network];
  return info.compose ? info.compose(caption, link) : info.home!;
}
