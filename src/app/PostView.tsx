// A post as its shared link shows it: from the public listing (a Public post) or, signed in, from the API. Comments,
// and writing posts, stay in the apps.
import type { Post } from '../lib/api';
import type { PublicListing } from '../lib/publicListing';
import { pathFor } from '../lib/routes';

export interface ShownPost {
  posterName: string;
  posterPath?: string;
  posterImage?: string;
  actingName?: string;
  body: string;
  createdAt?: string;
  edited?: boolean;
  photos: { url: string; alt?: string }[];
  event?: { name: string; path: string };
}

export function shownFromListing(listing: PublicListing): ShownPost {
  return {
    posterName: listing.poster?.name ?? listing.title,
    posterPath: listing.poster?.path,
    posterImage: listing.image,
    actingName: listing.acting_person_name,
    body: listing.body ?? listing.description,
    createdAt: listing.created_at,
    edited: listing.edited,
    photos: (listing.photos ?? []).map((photo) => ({ url: photo.url, alt: photo.alt_text })),
    event: listing.event && { name: listing.event.name, path: listing.event.path },
  };
}

export function shownFromAPI(post: Post): ShownPost {
  const poster = post.person ? pathFor({ kind: 'person', id: post.person.id })
    : post.venue ? pathFor({ kind: 'venue', id: post.venue.id }) : undefined;
  return {
    posterName: post.posterName ?? 'Hot Mess',
    posterPath: poster,
    posterImage: post.posterAvatarUrl ?? undefined,
    actingName: post.actingPersonName ?? undefined,
    body: post.body ?? '',
    createdAt: post.createdAt ?? undefined,
    edited: post.edited ?? false,
    photos: (post.photos ?? []).flatMap((photo) => photo.url ? [{ url: photo.url, alt: photo.altText ?? undefined }] : []),
    event: post.event ? { name: post.event.name ?? 'Event', path: pathFor({ kind: 'event', id: post.event.id }) } : undefined,
  };
}

function posted(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PostView({ post, footer }: { post: ShownPost; footer?: string }) {
  const name = post.posterPath ? <a href={post.posterPath}>{post.posterName}</a> : post.posterName;
  return <article className="card post">
    <header className="post-byline">
      {post.posterImage && <img className="post-face" src={post.posterImage} alt="" width={40} height={40} />}
      <div>
        <h1 className="post-poster">{name}</h1>
        <p className="muted small">
          {post.createdAt && <time dateTime={post.createdAt}>{posted(post.createdAt)}</time>}
          {post.edited && ' · Edited'}
          {post.event && <> · on <a href={post.event.path}>{post.event.name}</a></>}
        </p>
        {post.actingName && <p className="muted small">{post.actingName}</p>}
      </div>
    </header>
    {post.body && <p className="post-body">{post.body}</p>}
    {post.photos.length > 0 && <div className={`post-photos count-${post.photos.length}`}>
      {post.photos.map((photo) => <img key={photo.url} src={photo.url} alt={photo.alt ?? ''} loading="lazy" />)}
    </div>}
    <p className="post-footer"><strong>{footer ?? 'Comment and follow them in the Hot Mess app.'}</strong> <a href="/download">Get the app</a></p>
  </article>;
}
