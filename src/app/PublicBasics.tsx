import type { PublicListing } from '../lib/publicListing';
export default function PublicBasics({ listing }: { listing: PublicListing }) {
  return <section className="card">
    <h1>{listing.title}</h1>
    <p>{listing.description}</p>
    {listing.visibility === 'public' && <>
      {listing.image && <img src={listing.image} alt={listing.title} style={{ maxWidth: '100%' }} />}
      {listing.is_canceled && <p><strong>Canceled</strong></p>}
      {listing.start_at && <p>Starts: <time dateTime={listing.start_at}>{listing.start_at}</time></p>}
      {listing.end_at && <p>Ends: <time dateTime={listing.end_at}>{listing.end_at}</time></p>}
      {listing.venue_name && <p>{listing.venue_name}</p>}
      {listing.kind === 'event' && listing.address && <p>{listing.address}</p>}
      {listing.cover_cents != null && <p>Cover: ${(listing.cover_cents / 100).toFixed(2)}</p>}
      {listing.ticket_url && <p><a href={listing.ticket_url} rel="noopener noreferrer">Tickets</a></p>}
    </>}
    {listing.kind === 'venue' && <>
      {listing.address && <p>{listing.address}</p>}
      {listing.phone && <p>{listing.phone}</p>}
      {listing.website && <p><a href={listing.website} rel="noopener noreferrer">Venue website</a></p>}
    </>}
    <p><strong>{listing.kind === 'event' && listing.visibility !== 'public' ? 'Sign in to see when and where.' : 'Sign in to see more details.'}</strong></p>
  </section>;
}
