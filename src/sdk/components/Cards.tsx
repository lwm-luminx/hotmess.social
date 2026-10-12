// Cards for lists: a venue, an event, a person. Each is an <li> for use inside <Section>.
import type { Event, Friend, PersonReference, Venue } from '../types';
import { dateBadge, distance, eventHost, eventPhoto, eventPlace, eventTime, venuePhoto } from '../format';
import { Link } from '../navigation';
import { Photo } from './Primitives';

export function VenueCard({ venue, friendCount }: { venue: Venue; friendCount?: number }) {
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
          {venue.profile?.address ? <span className="ak-card__meta">{venue.profile.address}</span> : null}
          {friendCount ? <span className="ak-card__meta ak-accent">{friendCount} friends here</span> : null}
        </div>
      </Link>
    </li>
  );
}

export function EventCard({ event, showVenue = true }: { event: Event; showVenue?: boolean }) {
  const badge = dateBadge(event.startAt);
  const place = eventPlace(event);
  const host = eventHost(event);
  return (
    <li className="ak-card ak-card--event">
      <Link to={{ kind: 'event', id: event.id }} className="ak-card__link">
        <div className="ak-card__media">
          <Photo src={eventPhoto(event)} />
          {badge.day ? <span className="ak-date" aria-hidden="true"><span>{badge.month}</span><strong>{badge.day}</strong></span> : null}
        </div>
        <div className="ak-card__body">
          <strong className="ak-card__title">{event.name}</strong>
          <span className="ak-card__meta">{eventTime(event)}</span>
          {showVenue && place ? <span className="ak-card__meta">{place}</span> : null}
          {host ? <span className="ak-card__meta">with {host.name}</span> : null}
        </div>
      </Link>
    </li>
  );
}

export function PersonCard({ person }: { person: PersonReference }) {
  return (
    <li className="ak-person">
      <Link to={{ kind: 'person', id: person.id }} className="ak-person__link">
        <Photo src={person.avatarUrl} className="ak-avatar" name={person.name} />
        <span className="ak-person__name">{person.name}</span>
      </Link>
    </li>
  );
}

/** A friend who's out: Hot Mess users aren't pages, so this doesn't link anywhere. */
export function FriendChip({ friend }: { friend: Friend }) {
  return (
    <li className="ak-person">
      <span className="ak-person__link">
        <Photo src={friend.avatarUrl} className="ak-avatar" name={friend.name} />
        <span className="ak-person__name">{friend.name}</span>
      </span>
    </li>
  );
}
