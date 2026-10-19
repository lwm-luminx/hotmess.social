# hotmess.social edge

A Cloudflare Worker in front of the GitHub Pages site. It does two things GitHub Pages can't:

- **Rich link previews.** A share link like `/venues/<id>` is served by `404.html`, with a 404 status and the site's
  generic tags, so iMessage, Facebook, WhatsApp and Slack show nothing about the venue. The worker asks the AudienceKit
  API for the record's public card (`GET /v1/share?host=…&path=…`, audience-kit `api/doc/SHARE_CARDS.md`) and answers
  200 with its title, photo, description and Smart App Banner `app-argument` in the `<head>`. An unknown record keeps
  the 404; if the API can't answer, the page is served with the site's generic card.
- **`apple-app-site-association` as JSON.**
- **`/download` redirects.** iPhone and Android visitors get a 302 to their store (`src/lib/download.ts`); the page's
  own script does the same while the site is on GitHub Pages alone.

The page body is untouched, so the web app still runs and routes the link (`src/lib/routes.ts`).

## Deploy

1. Move hotmess.social's DNS to Cloudflare (Free plan) and keep the GitHub Pages records, proxied, SSL mode "Full".
2. From `edge/`: `npx wrangler deploy`.
3. Check: `curl -sI https://hotmess.social/venues/<id>` is 200, and the Facebook Sharing Debugger shows the venue.

Tests run with the site's: `npm test`.
