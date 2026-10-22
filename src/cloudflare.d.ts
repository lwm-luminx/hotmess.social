// Keep Worker bindings separate from DOM types used by the hydrated SPA.
declare module 'cloudflare:workers' {
  export const env: {
    PUBLIC_CONTENT_API_BASE?: string;
    PUBLIC_CONTENT_HOST?: string;
    PUBLIC_SITE_ORIGIN?: string;
    AUDIENCEKIT_SERVICE_TOKEN?: string;
  };
}
