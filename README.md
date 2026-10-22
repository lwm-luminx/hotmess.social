# hotmess.social

The Hot Mess web app and marketing site. Hot Mess is an audience on
[AudienceKit](https://audiencekit.com); this site talks to the same API as the
[iOS](https://github.com/audience-kit/hot_mess_ios) and
[Android](https://github.com/audience-kit/hot_mess_android) apps,
`https://api.audiencekit.com`.

## What's here

| Path | What it is |
| --- | --- |
| `/` | Marketing page (`src/pages/index.astro`) |
| `/app/` | The web app: Apple or Facebook sign-in (whichever AudienceKit has on), then Now (`src/components/AppShell.astro`) |
| `/venues/<id>`, `/events/<id>`, `/people/<id>` | Share links. GitHub Pages serves `404.html` for them, which runs the app and routes the same way the iOS app's `DeepLink` parser does (`src/lib/routes.ts`). |
| `/.well-known/apple-app-site-association` | Universal links for the Hot Mess iOS apps, so share links open the app when it's installed |
| `/.well-known/assetlinks.json` | Android App Links for `social.hotmess.android.app` (Play app signing) and the staging and development builds (debug key) |

Both link files come from AudienceKit: the Pages build fetches them from
`https://api.audiencekit.com/.well-known/<file>?host=hotmess.social`, which lists
the Hot Mess audience's apps (console → Settings → Apps). The copies in
`public/.well-known/` are what ships when the API can't answer.

Privacy, terms and data deletion link to the shared AudienceKit pages at
`audiencekit.com`, which the Hot Mess Facebook app (713525445368431) uses.

## Stack

[Astro](https://astro.build) builds a fully static site; the app is a small
TypeScript client with no UI framework. GitHub Actions builds every push and
publishes `main` to GitHub Pages (`.github/workflows/pages.yml`).

## Develop

Use Node 22.23.4 or newer. Shared branding and marketing components come from
[`@lwm-luminx/astro-components`](https://github.com/lwm-luminx/astro-components/pkgs/npm/astro-components).
The checked-in `.npmrc` maps that scope to GitHub Packages. Before installing,
set `NODE_AUTH_TOKEN` to a GitHub personal access token (classic) with
`read:packages` and access to the package. Keep the token out of source control.
GitHub Actions uses `GITHUB_TOKEN` with `packages: read`; grant this repository
Actions access in the package's settings before running CI.

```sh
npm ci
npm run dev     # http://localhost:4321
npm test        # route parser, formatting and API error tests
npm run build   # type-check and build to dist/
```

The app talks to the API's consumer GraphQL endpoint; its documents live in
`src/lib/api.ts` and `src/sdk/types.ts` mirrors them. The `GraphQL documents`
workflow validates them against the published schema
(https://developer.audiencekit.com/api/validate-documents/). To run the check
locally against a checkout of audience-kit:

```sh
node ../audience-kit/scripts/graphql-documents/check.mjs \
  --schema ../audience-kit/api/schema.graphql --endpoint consumer src e2e
```

Configuration is public build-time values only (see `.env.example`):
`PUBLIC_API_BASE`, `PUBLIC_FACEBOOK_APP_ID`, `PUBLIC_APPLE_SERVICES_ID` and
`PUBLIC_AUDIENCE_HOST` (a staging deployment points them at the next preview and
the staging app).

Sign in with Apple uses Apple's JS in a popup with the Services ID
`social.hotmess.signin`, which the Android app shares. Apple only accepts it on
the domains and return URLs that Services ID lists, so it needs
`hotmess.social` and `https://hotmess.social/app/` (add a staging host the same
way to try it there). The API accepts its tokens only with the nonce the site
sent Apple (api/doc/TOKENS.md in audience-kit). Never put a
secret in this repository or in a `PUBLIC_` variable; they ship to every visitor.

## End-to-end tests

Playwright drives Chromium through the site (`e2e/`, workflow `E2E`):

```sh
npx playwright install chromium
npm run build && npm run e2e   # built site, Facebook and the API mocked
npm run e2e:live               # hotmess.social against the real API
```

The mocked suite runs on every pull request and covers sign-in, Now, share
links, the venue, event and person pages (photos, Facebook links, tracks) and
their failure states. The live suite runs hourly and after each
deploy. To sign in it needs the repository secrets `FB_TEST_APP_ID`
(713525445368431, the app the Facebook test users belong to) and
`FB_TEST_APP_SECRET`, or a session JWT in `HOTMESS_E2E_TOKEN`; without them it
only checks the signed-out pages.

## Before it works end to end

- **Pages**: Settings → Pages → Source: GitHub Actions, custom domain
  `hotmess.social`, and DNS for the apex pointed at GitHub Pages.
- **API CORS**: the API allows an origin only when it is in `ADMIN_ORIGINS` or a
  verified audience domain (`api/config/initializers/cors.rb` in
  audience-kit/audience-kit), so verify `hotmess.social` on the Hot Mess audience.
- **Audience app**: the Hot Mess audience's Facebook apps in AudienceKit must
  include 1168782378316790 with its secret, or `/v1/token` answers 401.
- **Facebook**: add `hotmess.social` to the Hot Mess app's App Domains and as a
  Website platform so the JavaScript SDK can log in.
- **Android App Links**: `/.well-known/assetlinks.json` lists Play's app-signing
  certificates (from Play Console → App integrity). A new signing key goes into the
  audience's Android app in AudienceKit, then into this file on the next build.
