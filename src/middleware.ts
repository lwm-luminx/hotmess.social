import { defineMiddleware } from 'astro:middleware';
import { browserResponse, edgeResponse, pageCacheKey } from './server/pageCache';

// In-flight requests are coalesced within an isolate. Cloudflare's Cache API is per data center.
const pending = new Map<string, Promise<Response>>();
export const onRequest = defineMiddleware(async (context, next) => {
  const key = pageCacheKey(context.request);
  const cache = (globalThis.caches as CacheStorage & { default?: Cache } | undefined)?.default;
  if (!key || !cache || context.request.method === 'HEAD') return next();
  const hit = await cache.match(key);
  if (hit) return browserResponse(hit, context.request.method);
  const existing = pending.get(key.url);
  if (existing) return browserResponse((await existing).clone(), context.request.method);
  const operation = (async () => {
    const response = await next();
    const stored = edgeResponse(response);
    if (stored) await cache.put(key, stored);
    return response;
  })();
  pending.set(key.url, operation);
  try { return (await operation).clone(); } finally { pending.delete(key.url); }
});
