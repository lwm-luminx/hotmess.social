// Discover (/discover): every public venue, event and post, for someone signed in to Hot Mess. The listings come from
// the Worker (src/pages/discover/listings.ts), which checks the session before it answers.
import { useEffect, useState } from 'react';
import { session } from '../lib/api';
import type { PublicListing } from '../lib/publicListing';
import SignedIn from './SignedIn';

type Page = { listings: PublicListing[]; next_page: number | null };
type State = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; page: Page };

function Listings({ signOut }: { signOut: () => void }) {
  const page = Math.max(1, Number(new URLSearchParams(location.search).get('page')) || 1);
  const [state, setState] = useState<State>({ state: 'loading' });
  useEffect(() => {
    let current = true;
    fetch(`/discover/listings?page=${page}`, { headers: { authorization: `Bearer ${session.token}` } })
      .then(async (response) => {
        if (!current) return;
        if (response.status === 401) return signOut();
        if (!response.ok) return setState({ state: 'failed' });
        setState({ state: 'ready', page: await response.json() as Page });
      })
      .catch(() => { if (current) setState({ state: 'failed' }); });
    return () => { current = false; };
  }, [page]);
  if (state.state === 'loading') return <p className="muted">Loading…</p>;
  if (state.state === 'failed') return <p className="muted">Listings are temporarily unavailable. Please try again shortly.</p>;
  const { listings, next_page } = state.page;
  return <>
    <ul>{listings.map((item) => <li key={item.path}>
      <a href={item.path}>{item.kind === 'post' ? `Post by ${item.title}` : item.title}</a>
    </li>)}</ul>
    {next_page && <a href={`/discover?page=${next_page}`}>More listings</a>}
  </>;
}

export default function Discover() {
  return <SignedIn lede="Sign in to browse every venue, event and post on Hot Mess.">
    {(signOut) => <Listings signOut={signOut} />}
  </SignedIn>;
}
