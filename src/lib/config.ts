// Public build-time configuration. Everything here ships to the browser,
// so it must never hold a secret.
export const API_BASE: string =
  import.meta.env.PUBLIC_API_BASE ?? 'https://api.hotmess.social';

// The production Hot Mess Facebook app. Staging and development apps are
// 915436455177328 and 842337999153841.
export const FACEBOOK_APP_ID: string =
  import.meta.env.PUBLIC_FACEBOOK_APP_ID ?? '713525445368431';
