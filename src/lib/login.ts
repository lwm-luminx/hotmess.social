// Facebook sign-in through the OAuth dialog, the way the iOS app does it
// (hot_mess_ios HotMess/Services/FacebookWebLogin.swift).
//
// The Hot Mess Facebook app is a Business app, which only opens its login
// dialog with a Login for Business `config_id`; asking for `scope` instead
// fails with "This app needs at least one supported permission". The dialog
// redirects back with a code, which the API exchanges (POST /v1/token).

export interface FacebookLogin {
  appID: string;
  configID?: string | null;
}

export interface PendingLogin {
  state: string;
  appID: string;
  redirectURI: string;
  returnTo: string;
}

export const PERMISSIONS = ['public_profile', 'email'];

export function dialogURL(login: FacebookLogin, redirectURI: string, state: string): string {
  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  url.searchParams.set('client_id', login.appID);
  url.searchParams.set('redirect_uri', redirectURI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  if (login.configID) url.searchParams.set('config_id', login.configID);
  else url.searchParams.set('scope', PERMISSIONS.join(','));
  return url.toString();
}

export type Callback =
  | { kind: 'none' }
  | { kind: 'code'; code: string; pending: PendingLogin }
  | { kind: 'error'; message: string };

// Reads Facebook's redirect back to us, checking it answers the login we started.
export function parseCallback(search: string, pending: PendingLogin | null): Callback {
  const params = new URLSearchParams(search);
  const code = params.get('code');
  const error = params.get('error');
  if (!code && !error) return { kind: 'none' };
  if (!pending || params.get('state') !== pending.state) {
    return { kind: 'error', message: 'That sign-in link expired. Please try again.' };
  }
  if (error) {
    return params.get('error_reason') === 'user_denied'
      ? { kind: 'error', message: 'Facebook sign-in was cancelled.' }
      : { kind: 'error', message: params.get('error_description') ?? 'Facebook sign-in failed.' };
  }
  return { kind: 'code', code: code!, pending };
}
