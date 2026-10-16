// What GET /v1/share answers for a share link (audience-kit api/doc/SHARE_CARDS.md), and the <head> a link preview
// reads for it. Kept free of Workers APIs so `npm test` runs it under Node.

export interface ShareCard {
  kind: 'venue' | 'event' | 'person';
  id: string;
  url: string;
  title: string;
  description: string;
  site_name: string;
  image: { url: string; width: number | null; height: number | null; alt: string } | null;
}

/** The site's own card, for a share link whose record has no photo. */
export const DEFAULT_IMAGE = { url: 'https://hotmess.social/og/hot-mess.png', width: 1200, height: 630 };

/** iMessage, Facebook, Slack and friends read these; `app-argument` makes Safari's banner open the same screen. */
export function headTags(card: ShareCard, appStoreId: string): string {
  const image = card.image ?? { ...DEFAULT_IMAGE, alt: card.site_name };
  const tags = [
    `<title>${escape(`${card.title} · ${card.site_name}`)}</title>`,
    meta('name', 'description', card.description),
    `<link rel="canonical" href="${escape(card.url)}">`,
    meta('name', 'apple-itunes-app', `app-id=${appStoreId}, app-argument=${card.url}`),
    meta('property', 'og:site_name', card.site_name),
    meta('property', 'og:type', card.kind === 'person' ? 'profile' : 'website'),
    meta('property', 'og:title', card.title),
    meta('property', 'og:description', card.description),
    meta('property', 'og:url', card.url),
    meta('property', 'og:image', image.url),
    image.width ? meta('property', 'og:image:width', String(image.width)) : '',
    image.height ? meta('property', 'og:image:height', String(image.height)) : '',
    meta('property', 'og:image:alt', image.alt),
    // A square photo reads better as a small card than cropped to 1.91:1.
    meta('name', 'twitter:card', isLandscape(image) ? 'summary_large_image' : 'summary'),
  ];
  return tags.filter(Boolean).join('\n    ');
}

/**
 * Swaps the page's generic preview tags for the card's. The page is our own 404.html (src/layouts/Base.astro), so the
 * tags it replaces are known: the title, description, canonical, Smart App Banner, og:* (but fb:app_id) and twitter:*.
 */
export function rewriteHead(html: string, tags: string): string {
  const stripped = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<link rel="canonical"[^>]*>/gi, '')
    .replace(/<meta (?:name|property)="(?:description|apple-itunes-app|og:[^"]+|twitter:[^"]+)"[^>]*>/gi, '');
  return stripped.replace(/<head>/i, `<head>\n    ${tags}`);
}

function isLandscape(image: { width: number | null; height: number | null }): boolean {
  return !image.width || !image.height || image.width / image.height >= 1.3;
}

function meta(attribute: 'name' | 'property', key: string, content: string): string {
  return `<meta ${attribute}="${key}" content="${escape(content)}">`;
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
