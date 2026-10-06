// Public build-time configuration. Everything here ships to the browser,
// so it must never hold a secret.
export const API_BASE: string =
  import.meta.env.PUBLIC_API_BASE ?? 'https://api.hotmess.social';
