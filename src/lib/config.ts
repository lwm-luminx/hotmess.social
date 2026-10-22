// Public build-time configuration. Everything here ships to the browser,
// so it must never hold a secret. Values mirror the iOS release build
// (hot_mess_ios Configurations/HotMess.release.xcconfig).
export const API_BASE: string =
  import.meta.env.PUBLIC_API_BASE ?? 'https://api.audiencekit.com';

// The Hot Mess consumer Facebook app, which signs people in with classic
// Facebook Login. 713525445368431 is the AudienceKit platform app now.
export const FACEBOOK_APP_ID: string =
  import.meta.env.PUBLIC_FACEBOOK_APP_ID ?? '1168782378316790';

// The host that names the Hot Mess audience to the API at sign-in.
// hotmess.admin.audiencekit.com resolves by subdomain today; switch to
// hotmess.social once that domain is verified in AudienceKit.
export const AUDIENCE_HOST: string =
  import.meta.env.PUBLIC_AUDIENCE_HOST ?? 'hotmess.admin.audiencekit.com';

// Public TestFlight link for the Hot Mess 2.0 iPhone beta. Swap for the App
// Store link once the app is released.
export const IOS_BETA_URL = 'https://testflight.apple.com/join/mcPybJVN';

// Hot Mess is a Love Wins Media product; every page links here (BrandBand and BrandCredit from @lwm-luminx/astro-components, in src/layouts/Base.astro).
export const LOVE_WINS_URL = 'https://lovewins.media';

// Hot Mess on the App Store, for Safari's Smart App Banner (src/layouts/Base.astro).
export const APP_STORE_ID = '1195758383';
