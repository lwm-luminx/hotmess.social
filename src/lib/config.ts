// Public build-time configuration. Everything here ships to the browser,
// so it must never hold a secret. Defaults target Next, matching the iOS staging configuration.
export const API_BASE: string =
  import.meta.env.PUBLIC_API_BASE ?? 'https://api.next.audiencekit.com';

// The Hot Mess consumer Facebook app, which signs people in with classic
// Facebook Login. 713525445368431 is the AudienceKit platform app now.
export const FACEBOOK_APP_ID: string =
  import.meta.env.PUBLIC_FACEBOOK_APP_ID ?? '1660272792277019';

// The Services ID Sign in with Apple JS signs in with (src/lib/apple.ts), the
// Hot Mess one the Android app shares (primary App ID social.hotmess.HotMess).
// Apple accepts it only on the domains and return URLs it lists: hotmess.social
// and https://hotmess.social/app/. Empty leaves Apple off.
export const APPLE_SERVICES_ID: string =
  import.meta.env.PUBLIC_APPLE_SERVICES_ID ?? 'social.hotmess.signin';

// The host that names the Hot Mess audience to the API at sign-in.
// hotmess.admin.audiencekit.com resolves by subdomain today; switch to
// hotmess.social once that domain is verified in AudienceKit.
export const AUDIENCE_HOST: string =
  import.meta.env.PUBLIC_AUDIENCE_HOST ?? 'hotmess.admin.next.audiencekit.com';

// Hot Mess is a Love Wins Media product; every page links here (BrandBand and BrandCredit from @lwm-luminx/astro-components, in src/layouts/Base.astro).
export const LOVE_WINS_URL = 'https://lovewins.media';

// Hot Mess on the App Store, for Safari's Smart App Banner (src/layouts/Base.astro).
export const APP_STORE_ID = '1195758383';
