// Public build-time configuration. Everything here ships to the browser,
// so it must never hold a secret. Defaults target Next, matching the iOS staging configuration.
export const API_BASE: string =
  import.meta.env.PUBLIC_API_BASE ?? 'https://api.next.audiencekit.com';

// The Hot Mess consumer Facebook app, which signs people in with classic
// Facebook Login: the live app 1168782378316790, the same one the App Store
// build uses (hot_mess_ios HotMess.release.xcconfig). Never default to the
// staging app 1660272792277019: it stays in development mode, so Facebook
// refuses everyone without a role on it, Meta's App Reviewers included. Both
// APIs accept the live app for the Hot Mess audience (its AudienceApplication).
// 713525445368431 is the AudienceKit platform app now.
export const FACEBOOK_APP_ID: string =
  import.meta.env.PUBLIC_FACEBOOK_APP_ID ?? '1168782378316790';

// The Services ID Sign in with Apple JS signs in with (src/lib/apple.ts), the
// Hot Mess one the Android app shares (primary App ID social.hotmess.HotMess).
// Apple accepts it only on the domains and return URLs it lists: hotmess.social
// and https://hotmess.social/app/. Empty leaves Apple off.
export const APPLE_SERVICES_ID: string =
  import.meta.env.PUBLIC_APPLE_SERVICES_ID ?? 'social.hotmess.signin';

// The Google OAuth client Sign in with Google signs in with (src/lib/google.ts):
// Hot Mess's Web application client, the one the Android app uses as its
// serverClientId (hot_mess_android build.gradle.kts), which both APIs accept
// (GOOGLE_CLIENT_IDS). Google accepts it only from the Authorized JavaScript
// origins it lists: https://hotmess.social. Empty leaves Google off.
export const GOOGLE_CLIENT_ID: string =
  import.meta.env.PUBLIC_GOOGLE_CLIENT_ID ?? '689253921795-pt1trs3ss1fk61jmnoce5425m5t8pt7d.apps.googleusercontent.com';

// The host that names the Hot Mess audience to the API at sign-in.
// hotmess.admin.audiencekit.com resolves by subdomain today; switch to
// hotmess.social once that domain is verified in AudienceKit.
export const AUDIENCE_HOST: string =
  import.meta.env.PUBLIC_AUDIENCE_HOST ?? 'hotmess.admin.next.audiencekit.com';

// Hot Mess is a Love Wins Media product; every page links here (BrandBand and BrandCredit from @lwm-luminx/astro-components, in src/layouts/Base.astro).
export const LOVE_WINS_URL = 'https://lovewins.media';

// The company that operates Hot Mess, as named in every page footer (src/layouts/Base.astro). Keep it identical to
// audiencekit.com and lovewins.media: Microsoft PhotoDNA verifies the company against these details.
export const OPERATOR = {
  name: 'Love Wins Media, Inc.',
  address: '9407 NE Vancouver Mall Dr, Ste 104 #5436, Vancouver, WA 98662',
  email: 'rick@lovewins.media',
} as const;

// Hot Mess on the App Store, for Safari's Smart App Banner (src/layouts/Base.astro).
export const APP_STORE_ID = '1195758383';
