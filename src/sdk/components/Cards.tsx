// Cards for lists: a venue, an event, a person. Each is an <li> for use inside <Section>.
import type { Event, Friend, PersonReference, Venue } from '../types';
import { dateBadge, distance, eventPhoto, eventPlace, eventTime, venuePhoto } from '../format';
import { Link } from '../navigation';
import { Photo } from './Primitives';

export function VenueCard({ venue }: { venue: Venue }) {
  const away = distance(venue.distance);
  return (
    <li className="ak-card ak-card--venue">
      <Link to={{ kind: 'venue', id: venue.id }} className="ak-card__link">
        <div className="ak-card__media">
          <Photo src={venuePhoto(venue)} />
          {away ? <span className="ak-pill ak-card__badge">{away}</span> : null}
        </div>
        <div className="ak-card__body">
          <strong className="ak-card__title">{venue.name}</strong>
          {venue.address ? <span className="ak-card__meta">{venue.address}</span> : null}
          {venue.friend_count ? <span className="ak-card__meta ak-accent">{venue.friend_count} friends here</span> : null}
        </div>
      </Link>
    </li>
  );
}

export function EventCard({ event, showVenue = true }: { event: Event; showVenue?: boolean }) {
  const badge = dateBadge(event.start_at);
  const place = eventPlace(event);
  return (
    <li className="ak-card ak-card--event">
      <Link to={{ kind: 'event', id: event.id }} className="ak-card__link">
        <div className="ak-card__media">
          <Photo src={eventPhoto(event)} />
          <span className="ak-date" aria-hidden="true"><span>{badge.month}</span><strong>{badge.day}</strong></span>
        </div>
        <div className="ak-card__body">
          <strong className="ak-card__title">{event.name}</strong>
          <span className="ak-card__meta">{eventTime(event)}</span>
          {showVenue && place ? <span className="ak-card__meta">{place}</span> : null}
          {event.person ? <span className="ak-card__meta">with {event.person.name}</span> : null}
        </div>
      </Link>
    </li>
  );
}

export function PersonCard({ person }: { person: PersonReference }) {
  return (
    <li className="ak-person">
      <Link to={{ kind: 'person', id: person.id }} className="ak-person__link">
        <Photo src={person.photo_url} className="ak-avatar" name={person.name} />
        <span className="ak-person__name">{person.name}</span>
        {person.role ? <span className="ak-person__role">{person.role}</span> : null}
      </Link>
    </li>
  );
}

/** A friend who's out: Hot Mess users aren't pages, so this doesn't link anywhere. */
export function FriendChip({ friend }: { friend: Friend }) {
  return (
    <li className="ak-person">
      <span className="ak-person__link">
        <Photo className="ak-avatar" name={friend.name} />
        <span className="ak-person__name">{friend.name}</span>
      </span>
    </li>
  );
}
