// How components link to venues, events and people without knowing the host app's router.
// The host wraps them in <NavigationProvider> with its own hrefs and, for a single-page app,
// a click handler; without one, links are plain hrefs under /venues, /events and /people.
import { createContext, useContext, type MouseEvent, type ReactNode } from 'react';

export type Target =
  | { kind: 'venue'; id: string }
  | { kind: 'event'; id: string }
  | { kind: 'person'; id: string };

export interface Navigation {
  href(target: Target): string;
  /** Called on plain clicks (no modifier keys); call preventDefault to route in place. */
  onNavigate?(target: Target, event: MouseEvent<HTMLAnchorElement>): void;
}

const defaultNavigation: Navigation = {
  href: (target) => `/${{ venue: 'venues', event: 'events', person: 'people' }[target.kind]}/${target.id}`,
};

const NavigationContext = createContext<Navigation>(defaultNavigation);

export function NavigationProvider({ value, children }: { value: Navigation; children: ReactNode }) {
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function Link({ to, className, children, 'aria-label': label }: {
  to: Target; className?: string; children: ReactNode; 'aria-label'?: string;
}) {
  const navigation = useContext(NavigationContext);
  return (
    <a
      href={navigation.href(to)}
      className={className}
      aria-label={label}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        navigation.onNavigate?.(to, event);
      }}
    >
      {children}
    </a>
  );
}
