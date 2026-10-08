// Small building blocks the cards and detail views share.
import type { ReactNode } from 'react';
import { facebookURL, initials } from '../format';

/** An image that falls back to a tinted block (or initials) when there's no URL or it fails to load. */
export function Photo({ src, alt = '', className, name }: {
  src?: string | null; alt?: string; className?: string; name?: string;
}) {
  if (!src) {
    return (
      <div className={`ak-photo ak-photo--empty ${className ?? ''}`} role={name ? 'img' : undefined} aria-label={name}>
        {name ? <span aria-hidden="true">{initials(name)}</span> : null}
      </div>
    );
  }
  return (
    <img
      className={`ak-photo ${className ?? ''}`}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}
    />
  );
}

/** A full-width header photo with the title over its lower edge. */
export function Hero({ src, title, eyebrow, children }: {
  src?: string | null; title: string; eyebrow?: ReactNode; children?: ReactNode;
}) {
  return (
    <header className={`ak-hero ${src ? '' : 'ak-hero--plain'}`}>
      {src ? <img className="ak-hero__image" src={src} alt="" decoding="async" /> : null}
      <div className="ak-hero__text">
        {eyebrow ? <p className="ak-hero__eyebrow">{eyebrow}</p> : null}
        <h1 className="ak-hero__title">{title}</h1>
        {children}
      </div>
    </header>
  );
}

/** "View on Facebook", or nothing when there's no Facebook Page or event to link to. */
export function FacebookLink({ id, kind = 'page', label = 'View on Facebook' }: {
  id?: string | number | null; kind?: 'page' | 'event'; label?: string;
}) {
  const href = facebookURL(id, kind);
  if (!href) return null;
  return (
    <a className="ak-button ak-button--secondary" href={href} target="_blank" rel="noopener noreferrer">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M13.5 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1Z"/></svg>
      {label}
    </a>
  );
}

/** A titled group of cards; renders nothing when it has none, unless it has an empty message. */
export function Section({ title, children, empty, count }: {
  title: string; children: ReactNode[]; empty?: string; count?: number;
}) {
  if (!children.length && !empty) return null;
  return (
    <section className="ak-section">
      <h2 className="ak-section__title">
        {title}
        {count != null ? <span className="ak-section__count">{count}</span> : null}
      </h2>
      {children.length ? <ul className="ak-grid">{children}</ul> : <p className="ak-muted">{empty}</p>}
    </section>
  );
}

/** A key-value line in a detail view's facts list ("Address", "Phone"). */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ak-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
