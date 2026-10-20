// https://hotmess.social/download sends phones to their store. Shared by the page (src/pages/download.astro) and the
// edge worker (edge/src/worker.ts), so both send people to the same place. Kept out of config.ts, which reads
// import.meta.env and so can't load in the worker.
export const APP_STORE_URL = 'https://apps.apple.com/us/app/hot-mess-gay-nightlife/id1195758383';

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=social.hotmess.android.app';

/**
 * The store for this browser: iPhone, iPad and iPod get the App Store, Android Google Play, and anything else null
 * (the page with both links). iPadOS Safari reports a Mac user agent; pass `touchPoints` (navigator.maxTouchPoints)
 * to tell it from a real Mac.
 */
export function downloadUrl(userAgent: string, touchPoints = 0): string | null {
  if (/android/i.test(userAgent)) return PLAY_STORE_URL;
  if (/iphone|ipad|ipod/i.test(userAgent)) return APP_STORE_URL;
  if (/macintosh/i.test(userAgent) && touchPoints > 1) return APP_STORE_URL;
  return null;
}
