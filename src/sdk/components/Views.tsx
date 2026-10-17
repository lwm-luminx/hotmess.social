// Whole-page views: Now, a venue, an event, a person. They take data and render it; fetching,
// routing and sign-in belong to the host app.
import type { Event, Now, Person, Venue } from '../types';
import { eventHosts, eventLineup, eventPhoto, eventPlace, eventTime, facebookID, nodes, providerName, venueHero } from '../format';
import { Link } from '../navigation';
import { EventCard, FriendChip, PersonCard, VenueCard } from './Cards';
import { Fact, FacebookLink, Hero, Photo, Section } from './Primitives';

export function NowView({ now }: { now: Now }) {
  const { venue, locale } = now;
  const venues = venue ? [venue] : now.nearbyVenues ?? [];
  const events = nodes(locale?.events?.upcoming);
  const friends = nodes(locale?.friends?.list);
  const friendCount = new Map(nodes(locale?.friends?.venues).map((f) => [f.venue.id, f.friendCount]));
  const title = venue?.name || locale?.name || 'Now';
  const eyebrow = venue ? locale?.name : locale?.label;
  return (
    <div className="ak-view">
      <Hero src={venue ? venueHero(venue) : locale?.bannerUrl} title={title} eyebrow={eyebrow} />
      {venue ? (
        <p className="ak-lede">
          You're at <Link to={{ kind: 'venue', id: venue.id }}>{venue.name}</Link>.
        </p>
      ) : null}
      <Section title="Friends out tonight" count={friends.length || undefined} empty="None of your friends are out yet.">
        {friends.map((friend) => <FriendChip key={friend.id} friend={friend} />)}
      </Section>
      <Section title="Tonight and coming up" count={events.length || undefined}>
        {events.map((event) => <EventCard key={event.id} event={event} />)}
      </Section>
      <Section title={venue ? 'Here' : 'Venues near you'}>
        {venues.map((v) => <VenueCard key={v.id} venue={v} friendCount={friendCount.get(v.id)} />)}
      </Section>
    </div>
  );
}

export function VenueView({ venue, events = [] }: { venue: Venue; events?: Event[] }) {
  const hero = venueHero(venue);
  const profile = venue.profile;
  return (
    <div className="ak-view">
      <Hero src={hero} title={venue.name ?? ''}>
        {venue.photoUrl && hero && venue.photoUrl !== hero ? <Photo src={venue.photoUrl} className="ak-hero__badge" /> : null}
      </Hero>
      <div className="ak-columns">
        <div>
          {venue.description ? <p className="ak-lede">{venue.description}</p> : null}
          <Section title="Upcoming" count={events.length || undefined} empty="Nothing announced yet.">
            {events.map((event) => <EventCard key={event.id} event={event} showVenue={false} />)}
          </Section>
        </div>
        <aside className="ak-panel">
          <dl className="ak-facts">
            {profile?.address ? (
              <Fact label="Address">
                <a href={`https://maps.apple.com/?q=${encodeURIComponent(`${venue.name}, ${profile.address}`)}`} target="_blank" rel="noopener noreferrer">{profile.address}</a>
              </Fact>
            ) : null}
            {profile?.phone ? <Fact label="Phone"><a href={`tel:${profile.phone}`}>{profile.phone}</a></Fact> : null}
          </dl>
          <div className="ak-actions"><FacebookLink id={profile?.facebook?.facebookId} /></div>
        </aside>
      </div>
    </div>
  );
}

export function EventView({ event }: { event: Event }) {
  const venue = event.venue?.venue ?? null;
  const place = eventPlace(event);
  const hosts = eventHosts(event);
  const people = eventLineup(event);
  return (
    <div className="ak-view">
      <Hero src={eventPhoto(event)} title={event.name ?? ''} eyebrow={eventTime(event) || undefined} />
      <div className="ak-columns">
        <div>
          <Section title={hosts.length === 1 ? 'Host' : 'Hosts'}>
            {hosts.map((person) => <PersonCard key={person.id} person={person} />)}
          </Section>
          <Section title="On the bill" count={people.length || undefined}>
            {people.map((person) => <PersonCard key={person.id} person={person} />)}
          </Section>
          <Section title="Where">
            {venue ? [<VenueCard key={venue.id} venue={venue} />] : []}
          </Section>
          {!venue ? <p className="ak-lede">Venue to be announced.</p> : null}
        </div>
        <aside className="ak-panel">
          <dl className="ak-facts">
            {event.startAt ? <Fact label="When">{eventTime(event)}</Fact> : null}
            {place ? <Fact label="Where">{venue ? <Link to={{ kind: 'venue', id: venue.id }}>{place}</Link> : place}</Fact> : null}
            {venue?.profile?.address ? <Fact label="Address">{venue.profile.address}</Fact> : null}
          </dl>
          <div className="ak-actions">
            {facebookID(event.facebookId)
              ? <FacebookLink id={event.facebookId} kind="event" label="Event on Facebook" />
              : <FacebookLink id={venue?.profile?.facebook?.facebookId} label="Venue on Facebook" />}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function PersonView({ person }: { person: Person }) {
  const events = nodes(person.events?.upcoming);
  // Their social profiles, then where their music is.
  const links = [...nodes(person.profile?.socialLinks), ...nodes(person.music?.links)];
  const tracks = nodes(person.music?.tracks);
  return (
    <div className="ak-view">
      <Hero src={person.bannerUrl} title={person.name ?? ''}>
        <Photo src={person.avatarUrl} className="ak-hero__avatar" name={person.name} />
      </Hero>
      <div className="ak-columns">
        <div>
          <Section title="Upcoming" count={events.length || undefined} empty="No upcoming events.">
            {events.map((event) => <EventCard key={event.id} event={event} />)}
          </Section>
          <Section title="Tracks">
            {tracks.map((track) => (
              <li key={track.id} className="ak-card ak-card--track">
                <a className="ak-card__link" href={track.providerUrl ?? '#'} target="_blank" rel="noopener noreferrer">
                  <div className="ak-card__media"><Photo src={track.artworkUrl} /></div>
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
                  <a href={link.url ?? undefined} target="_blank" rel="noopener noreferrer">
                    <strong>{providerName(link.provider)}</strong>
                    {link.handle ? <span className="ak-muted"> {link.handle}</span> : null}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="ak-actions"><FacebookLink id={person.profile?.facebook?.facebookId} /></div>
        </aside>
      </div>
    </div>
  );
}
