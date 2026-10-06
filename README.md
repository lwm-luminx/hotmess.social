# hotmess.social

The Hot Mess web app and marketing site. Hot Mess is an audience on
[AudienceKit](https://audiencekit.com); this site talks to the same API as the
[iOS](https://github.com/audience-kit/hot_mess_ios) and
[Android](https://github.com/audience-kit/hot_mess_android) apps,
`https://api.hotmess.social`.

## What's here

| Path | What it is |
| --- | --- |
| `/` | Marketing page (`src/pages/index.astro`) |
| `/app/` | The web app: Facebook sign-in, then Now (`src/components/AppShell.astro`). Sign-in opens Facebook's OAuth dialog with the audience's Login for Business config from `/v1/branding`, and the API exchanges the code it returns (`src/lib/login.ts`). |
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
`PUBLIC_API_BASE`. The Facebook app and login config come from the API's
`/v1/branding` for the page's host, so sign-in only works on a host that
belongs to an audience, not on `localhost`. Never put a secret in this
repository or in a `PUBLIC_` variable; both ship to every visitor.

## Before it works end to end

- **Pages**: Settings → Pages → Source: GitHub Actions, custom domain
  `hotmess.social`, and DNS for the apex pointed at GitHub Pages.
- **API CORS**: the API must allow `https://hotmess.social`
  (audience-kit/audience-kit#37).
- **Facebook**: add `https://hotmess.social/app/` to the Hot Mess app's Valid
  OAuth Redirect URIs (Facebook Login for Business → Settings), and
  `hotmess.social` to its App Domains.
- **Android App Links**: `/.well-known/assetlinks.json` needs the release
  signing certificate's SHA-256 fingerprint, which isn't in the repo yet.
