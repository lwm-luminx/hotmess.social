// @ts-check
import { defineConfig } from 'astro/config';

// Static build served by GitHub Pages at https://hotmess.social.
export default defineConfig({
  site: 'https://hotmess.social',
  trailingSlash: 'ignore',
});
