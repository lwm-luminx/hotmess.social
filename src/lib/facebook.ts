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

// Whether sign-in asks for email and user_friends (friends who also use Hot
// Mess at the same venue), like the Android app. Meta's App Reviewers test
// user_friends on the web, so the website has to ask for it: until Meta
// approves the two, Facebook offers them only to people with a role on the app
// (reviewers included) and leaves them out for everyone else.
const ASKS_FOR_REVIEWED_PERMISSIONS = true;

const SCOPE = ['public_profile', ...(ASKS_FOR_REVIEWED_PERMISSIONS ? ['email', 'user_friends'] : [])].join(',');

// The Graph API version the site calls.
const GRAPH_API_VERSION = 'v26.0';

type FacebookSDK = NonNullable<Window['FB']>;

let loading: Promise<FacebookSDK> | null = null;
// The SDK once it has loaded, so a click can open Facebook's window straight away.
let loaded: FacebookSDK | null = null;

function sdk(): Promise<FacebookSDK> {
  loading ??= new Promise<FacebookSDK>((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB!.init({ appId: FACEBOOK_APP_ID, version: GRAPH_API_VERSION, cookie: false, xfbml: false });
      loaded = window.FB!;
      resolve(window.FB!);
    };
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => {
      loading = null;
      reject(new Error('Could not load Facebook Login'));
    };
    document.head.append(script);
  });
  return loading;
}

// Loads the SDK before anyone clicks. FB.login opens a popup, and browsers
// (Safari above all) block a popup that isn't opened while the click is still
// being handled, so loading the SDK only on the click left the first click
// with no Facebook window at all.
export function prepareFacebookSignIn(): Promise<void> {
  return sdk().then(() => undefined);
}

// Call straight from the click, before any await: once the SDK has loaded,
// FB.login runs synchronously so its popup is allowed.
export function facebookAccessToken(): Promise<string> {
  const login = (FB: FacebookSDK) => new Promise<string>((resolve, reject) => {
    FB.login((response) => {
      const token = response.authResponse?.accessToken;
      if (token) resolve(token); else reject(new Error('Facebook sign-in was cancelled'));
    }, { scope: SCOPE });
  });
  return loaded ? login(loaded) : sdk().then(login);
}
