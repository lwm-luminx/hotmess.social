import { defineMiddleware } from 'astro:middleware';
import { browserResponse, edgeResponse, pageCacheKey } from './server/pageCache';

// Cloudflare's Cache API is per data center. Requests are not coalesced: a Response one request is still rendering
// can't be read from another (Cloudflare refuses I/O across requests), so each renders its own until one is cached.
export const onRequest = defineMiddleware(async (context, next) => {
  const key = pageCacheKey(context.request);
  const cache = (globalThis.caches as CacheStorage & { default?: Cache } | undefined)?.default;
  if (!key || !cache || context.request.method === 'HEAD') return next();
  const hit = await cache.match(key);
  if (hit) return browserResponse(hit, context.request.method);
  const response = await next();
  const stored = edgeResponse(response);
  if (stored) await cache.put(key, stored);
  return response;
});
