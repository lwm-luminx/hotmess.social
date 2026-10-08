// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Static build served by GitHub Pages at https://hotmess.social. The app at /app/ is a React island
// built from the components in src/sdk, which are shaped to move into an AudienceKit React SDK.
export default defineConfig({
  site: 'https://hotmess.social',
  trailingSlash: 'ignore',
  integrations: [react()],
});
