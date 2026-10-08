// Whole-page views: Now, a venue, an event, a person. They take data and render it; fetching,
// routing and sign-in belong to the host app.
import type { Event, Now, Person, Venue } from '../types';
import { eventPhoto, eventPlace, eventTime, facebookID, providerName, venueHero } from '../format';
import { Link } from '../navigation';
import { EventCard, FriendChip, PersonCard, VenueCard } from './Cards';
import { Fact, FacebookLink, Hero, Photo, Section } from './Primitives';

export function NowView({ now }: { now: Now }) {
  const venues = now.venues ?? (now.venue ? [now.venue] : []);
  const events = now.events ?? [];
  const friends = now.friends ?? [];
  return (
    <div className="ak-view">
      <Hero src={now.image_url ?? venueHero(now.venue)} title={now.title ?? 'Now'} eyebrow={now.locale?.name} />
      {now.venue ? (
        <p className="ak-lede">
          You're at <Link to={{ kind: 'venue', id: now.venue.id }}>{now.venue.name}</Link>.
        </p>
      ) : null}
      <Section title="Friends out tonight" count={friends.length || undefined} empty="None of your friends are out yet.">
        {friends.map((friend) => <FriendChip key={friend.id} friend={friend} />)}
      </Section>
      <Section title="Tonight and coming up" count={events.length || undefined}>
        {events.map((event) => <EventCard key={event.id} event={event} />)}
      </Section>
      <Section title={now.venue ? 'Here' : 'Venues near you'}>
        {venues.map((venue) => <VenueCard key={venue.id} venue={venue} />)}
      </Section>
    </div>
  );
}

export function VenueView({ venue, events = [] }: { venue: Venue; events?: Event[] }) {
  // A venue's event list only names the venue; give each event this venue's photos to fall back on.
  const withVenue = events.map((event) => ({ ...event, venue: { ...venue, ...event.venue, hero_url: event.venue?.hero_url ?? venue.hero_url } }));
  return (
    <div className="ak-view">
      <Hero src={venueHero(venue)} title={venue.name} eyebrow={venue.is_open === false ? 'Closed' : undefined}>
        {venue.photo_url && venue.hero_url ? <Photo src={venue.photo_url} className="ak-hero__badge" /> : null}
      </Hero>
      <div className="ak-columns">
        <div>
          {venue.description ? <p className="ak-lede">{venue.description}</p> : null}
          <Section title="Upcoming" count={events.length || undefined} empty="Nothing announced yet.">
            {withVenue.map((event) => <EventCard key={event.id} event={event} showVenue={false} />)}
          </Section>
        </div>
        <aside className="ak-panel">
          <dl className="ak-facts">
            {venue.address ? (
              <Fact label="Address">
                <a href={`https://maps.apple.com/?q=${encodeURIComponent(`${venue.name}, ${venue.address}`)}`} target="_blank" rel="noopener noreferrer">{venue.address}</a>
              </Fact>
            ) : null}
            {venue.phone ? <Fact label="Phone"><a href={`tel:${venue.phone}`}>{venue.phone}</a></Fact> : null}
          </dl>
          <div className="ak-actions"><FacebookLink id={venue.facebook_id} /></div>
        </aside>
      </div>
    </div>
  );
}

export function EventView({ event }: { event: Event }) {
  const place = eventPlace(event);
  const people = event.people ?? (event.person ? [event.person] : []);
  return (
    <div className="ak-view">
      <Hero src={eventPhoto(event)} title={event.name} eyebrow={eventTime(event)} />
      <div className="ak-columns">
        <div>
          <Section title="On the bill" count={people.length || undefined}>
            {people.map((person) => <PersonCard key={person.id} person={person} />)}
          </Section>
          <Section title="Where">
            {event.venue ? [<VenueCard key={event.venue.id} venue={event.venue} />] : []}
          </Section>
          {!event.venue && place ? <p className="ak-lede">At {place} (venue to be announced).</p> : null}
        </div>
        <aside className="ak-panel">
          <dl className="ak-facts">
            <Fact label="When">{eventTime(event)}</Fact>
            {place ? <Fact label="Where">{event.venue ? <Link to={{ kind: 'venue', id: event.venue.id }}>{place}</Link> : place}</Fact> : null}
            {event.venue?.address ? <Fact label="Address">{event.venue.address}</Fact> : null}
          </dl>
          <div className="ak-actions">
            {facebookID(event.facebook_id)
              ? <FacebookLink id={event.facebook_id} kind="event" label="Event on Facebook" />
              : <FacebookLink id={event.venue?.facebook_id} label="Venue on Facebook" />}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function PersonView({ person }: { person: Person }) {
  const events = person.events ?? [];
  const links = person.social_links ?? [];
  const tracks = person.tracks ?? [];
  return (
    <div className="ak-view">
      <Hero src={person.cover_url} title={person.name}>
        <Photo src={person.photo_url} className="ak-hero__avatar" name={person.name} />
      </Hero>
      <div className="ak-columns">
        <div>
          <Section title="Upcoming" count={events.length || undefined} empty="No upcoming events.">
            {events.map((event) => <EventCard key={event.id} event={event} />)}
          </Section>
          <Section title="Tracks">
            {tracks.map((track) => (
              <li key={track.id} className="ak-card ak-card--track">
                <a className="ak-card__link" href={track.provider_url ?? track.stream_url ?? '#'} target="_blank" rel="noopener noreferrer">
                  <div className="ak-card__media"><Photo src={track.artwork_url} /></div>
                  <div className="ak-card__body">
                    <strong className="ak-card__title">{track.title}</strong>
                    {track.provider ? <span className="ak-card__meta">{providerName(track.provider)}</span> : null}
                  </div>
                </a>
              </li>
            ))}
          </Section>
        </div>
        <aside className="ak-panel">
          {links.length ? (
            <ul className="ak-links">
              {links.map((link) => (
                <li key={link.id}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    <strong>{providerName(link.provider)}</strong>
                    {link.handle ? <span className="ak-muted"> {link.handle}</span> : null}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="ak-actions"><FacebookLink id={person.facebook_id} /></div>
        </aside>
      </div>
    </div>
  );
}
