import type { PublicListing } from '../lib/publicListing';
export default function PublicBasics({ listing }: { listing: PublicListing }) {
  return <section className="card">
    <h1>{listing.title}</h1>
    <p>{listing.description}</p>
    {listing.kind === 'venue' && <>
      {listing.address && <p>{listing.address}</p>}
      {listing.phone && <p>{listing.phone}</p>}
      {listing.website && <p><a href={listing.website} rel="noopener noreferrer">Venue website</a></p>}
    </>}
    <p><strong>{listing.kind === 'event' ? 'Sign in to see when and where.' : 'Sign in to see more details.'}</strong></p>
  </section>;
}
