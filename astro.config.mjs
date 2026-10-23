// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';

// Marketing pages remain static; public record routes render on Cloudflare Workers.
export default defineConfig({
  site: 'https://hotmess.social',
  trailingSlash: 'ignore',
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [react()],
});