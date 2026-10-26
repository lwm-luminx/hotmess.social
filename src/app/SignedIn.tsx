// The gate in front of a signed-in page on the marketing site (/discover): its content once someone is signed in to
// Hot Mess, else the web app's sign-in card. Render it client:only, since the session lives in this browser's storage.
// The gate is the UI; anything the page loads must still be checked by whatever serves it (the API, or the Worker for
// /discover/listings).
import { useState, type ReactNode } from 'react';
import { session } from '../lib/api';
import ErrorBoundary from './ErrorBoundary';
import SignIn from './SignIn';

interface Props {
  /** Why the page needs sign-in, under the card's heading. */
  lede?: string;
  /** The page, given a way to send someone back to sign-in when the API says their session ended. */
  children: (signOut: () => void) => ReactNode;
}

export default function SignedIn({ lede, children }: Props) {
  const [signedIn, setSignedIn] = useState(() => !!session.token);
  const signOut = () => { session.end(); setSignedIn(false); };
  return <ErrorBoundary>
    {signedIn ? children(signOut) : <SignIn lede={lede} onSignedIn={() => setSignedIn(true)} />}
  </ErrorBoundary>;
}
