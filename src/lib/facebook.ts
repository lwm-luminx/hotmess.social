// Facebook Login through the JavaScript SDK. The API exchanges the short
// user access token for a long-lived one, exactly as it does for the iOS app.
import { FACEBOOK_APP_ID } from './config';

declare global {
  interface Window {
    FB?: {
      init(options: Record<string, unknown>): void;
      login(callback: (response: { authResponse?: { accessToken: string } }) => void, options?: { scope: string }): void;
    };
    fbAsyncInit?: () => void;
  }
}

let loading: Promise<NonNullable<Window['FB']>> | null = null;

function sdk(): Promise<NonNullable<Window['FB']>> {
  loading ??= new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB!.init({ appId: FACEBOOK_APP_ID, version: 'v21.0', cookie: false, xfbml: false });
      resolve(window.FB!);
    };
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => reject(new Error('Could not load Facebook Login'));
    document.head.append(script);
  });
  return loading;
}

export async function facebookAccessToken(): Promise<string> {
  const FB = await sdk();
  return new Promise((resolve, reject) => {
    FB.login((response) => {
      const token = response.authResponse?.accessToken;
      if (token) resolve(token); else reject(new Error('Facebook sign-in was cancelled'));
    }, { scope: 'public_profile,email' });
  });
}
