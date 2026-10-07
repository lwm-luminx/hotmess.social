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
| `/app/` | The web app: Facebook sign-in, then Now (`src/components/AppShell.astro`) |
| `/venues/<id>`, `/events/<id>`, `/people/<id>` | Share links. GitHub Pages serves `404.html` for them, which runs the app and routes the same way the iOS app's `DeepLink` parser does (`src/lib/routes.ts`). |
| `/.well-known/apple-app-site-association` | Universal links for `DWVXMLB45Y.social.hotmess.HotMess`, so share links open the iOS app when it's installed |

Privacy, terms and data deletion link to the shared AudienceKit pages at
`audiencekit.com`, which the Hot Mess Facebook app (713525445368431) uses.

## Stack

[Astro](https://astro.build) builds a fully static site; the app is a small
TypeScript client with no UI framework. GitHub Actions builds every push and
publishes `main` to GitHub Pages (`.github/workflows/pages.yml`).

## Develop

```sh
npm ci
npm run dev     # http://localhost:4321
npm test        # route parser tests
npm run build   # type-check and build to dist/
```

Configuration is public build-time values only (see `.env.example`):
`PUBLIC_API_BASE`, `PUBLIC_FACEBOOK_APP_ID`, `PUBLIC_AUDIENCE_HOST` and
`PUBLIC_AUDIENCEKIT_ENVIRONMENT` (`staging` for a staging deployment). Never put a
secret in this repository or in a `PUBLIC_` variable; they ship to every visitor.

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
- **Android App Links**: `/.well-known/assetlinks.json` needs the release
  signing certificate's SHA-256 fingerprint, which isn't in the repo yet.
