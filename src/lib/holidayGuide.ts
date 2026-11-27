// The holiday food guides (/thanksgiving, /christmas and their /<city> pages): shareable pages that lead with a city's
// free holiday meals and show how to find free food in Hot Mess. The meals are ordinary community resources named
// "<Holiday> meal: <org> (<city>)", loaded for the holiday and hidden after it (audience_kit_api), so these pages read
// the same live directory as /resources/<city>. Pure helpers only.
import type { CommunityResource, ResourceLocale, ResourceSlot } from './communityResources';
import { citySlug } from './communityResources.ts';

export interface Holiday {
  /** The path: /<slug> and /<slug>/<city>. */
  slug: string;
  /** "Thanksgiving", "Christmas". */
  name: string;
  /** Every meal resource's name starts with this. */
  mealPrefix: string;
  /** The line over the headline, "Thanksgiving · Thursday, Nov 26". */
  dateLine: string;
  /** Which day a meal is on, by its slot's weekday (0 Sunday), when the holiday spans more than one. */
  days: Record<number, string>;
  /** The city page's lede. */
  lede: string;
  /** The heading over a city's meals. */
  mealsTitle: string;
  /** What a city page says when it lists no meal (yet). */
  noMeals: (city: string) => string;
  /** The fine print's "checked" phrase. */
  checked: string;
  /** When the holiday is over everywhere Hot Mess is (ISO instant): from then the pages stop saying "today". */
  ends: string;
  /** What the pages say once it's over: the year-round food stays, the holiday's own promises don't. */
  after: { lede: string; indexLede: string; mealsTitle: string; noMeals: (city: string) => string };
  /** The next holiday's guide to point to once this one is over. */
  next?: string;
}

export const HOLIDAYS: Record<string, Holiday> = {
  thanksgiving: {
    slug: 'thanksgiving', name: 'Thanksgiving', mealPrefix: 'Thanksgiving meal: ',
    dateLine: 'Thanksgiving · Thursday, Nov 26', days: {},
    lede: 'Nobody should go hungry today. These are free and open to the public. Hours change on holidays, so call ahead if you can.',
    mealsTitle: 'Free Thanksgiving meals today',
    noMeals: (city) => `We haven’t found a free Thanksgiving Day meal in ${city} we could confirm. These places give out free food, and 211 knows what’s open today.`,
    checked: 'checked Nov 25, 2026',
    ends: '2026-11-27T12:00:00Z',
    after: {
      lede: 'Thanksgiving Day has passed. These places give out free food all year. Hours change, so call ahead if you can.',
      indexLede: 'Thanksgiving Day has passed, and these places give out free food all year. Pick your city for its pantries and meal programs. No sign-in needed.',
      mealsTitle: 'Free Thanksgiving meals',
      noMeals: (city) => `Thanksgiving’s free meals in ${city} are over. These places give out free food all year.`,
    },
    next: 'christmas',
  },
  christmas: {
    slug: 'christmas', name: 'Christmas', mealPrefix: 'Christmas meal: ',
    dateLine: 'Christmas Eve & Christmas Day · Dec 24–25', days: { 4: 'Christmas Eve, Thu Dec 24', 5: 'Christmas Day, Fri Dec 25' },
    lede: 'Nobody should go hungry, or eat alone, this Christmas. These are free and open to the public. Hours change on holidays, so call ahead if you can.',
    mealsTitle: 'Free Christmas meals',
    noMeals: (city) => `We haven’t confirmed a free Christmas Eve or Christmas Day meal in ${city} yet. We add them as they’re announced, so check back. Meanwhile these places give out free food, and 211 knows what’s open on the holiday.`,
    checked: 'checked as they’re announced in December 2026',
    ends: '2026-12-26T12:00:00Z',
    after: {
      lede: 'Christmas has passed. These places give out free food all year. Hours change, so call ahead if you can.',
      indexLede: 'Christmas has passed, and these places give out free food all year. Pick your city for its pantries and meal programs. No sign-in needed.',
      mealsTitle: 'Free Christmas meals',
      noMeals: (city) => `Christmas’s free meals in ${city} are over. These places give out free food all year.`,
    },
  },
};

/** Whether a holiday is over (its guide stays up for the year-round food). */
export const holidayOver = (holiday: Holiday, now: Date = new Date()): boolean => now.getTime() >= Date.parse(holiday.ends);

/** The holiday as its pages should word it now: its own copy until it ends, the "after" copy from then. */
export function holidayNow(holiday: Holiday, now: Date = new Date()): Holiday & { over: boolean } {
  if (!holidayOver(holiday, now)) return { ...holiday, over: false };
  return { ...holiday, lede: holiday.after.lede, mealsTitle: holiday.after.mealsTitle, noMeals: holiday.after.noMeals, over: true };
}

/** A venue's holiday event that hasn't finished: its end, or six hours from its start when it lists none. */
export function eventStillOn(startAt: string | null | undefined, endAt: string | null | undefined, now: Date = new Date()): boolean {
  const end = endAt ? Date.parse(endAt) : startAt ? Date.parse(startAt) + 6 * 3600_000 : NaN;
  return Number.isNaN(end) || end > now.getTime();
}

export const MEAL_PREFIXES = Object.values(HOLIDAYS).map((h) => h.mealPrefix);

export interface HolidayMeal {
  id: string; org: string; day: string | null; time: string | null; address: string | null; phone: string | null;
  url: string | null; intakeNote: string | null; description: string | null;
}

function clock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
}

/** "7am–3pm", or "From 11am" when the meal runs until the food runs out; null when no time is listed. */
export function mealTime(slot: ResourceSlot | undefined): string | null {
  if (!slot?.from) return null;
  return slot.until ? `${clock(slot.from)}–${clock(slot.until)}` : `From ${clock(slot.from)}`;
}

/** "Salt Lake City Mission" from "Thanksgiving meal: Salt Lake City Mission (Salt Lake)". */
export const mealOrg = (name: string, prefix: string = HOLIDAYS.thanksgiving.mealPrefix): string =>
  name.slice(prefix.length).replace(/\s*\([^()]*\)\s*$/, '').trim() || name;

/** A city's meals for a holiday, by day and then earliest first. */
export function holidayMeals(resources: CommunityResource[], holiday: Holiday = HOLIDAYS.thanksgiving): HolidayMeal[] {
  return resources
    .filter((r) => r.name.startsWith(holiday.mealPrefix))
    .map((r) => {
      const slot = r.sessions[0] ?? r.hours[0];
      const weekday = slot?.days?.[0];
      const day = weekday !== undefined ? holiday.days[weekday] ?? null : null;
      return { id: r.id, org: mealOrg(r.name, holiday.mealPrefix), day, time: mealTime(slot),
        sort: `${weekday ?? 9}${slot?.from ?? '99:99'}`, address: r.address, phone: r.phone, url: r.url,
        intakeNote: r.intakeNote, description: r.description };
    })
    .sort((a, b) => a.sort.localeCompare(b.sort) || a.org.localeCompare(b.org))
    .map(({ sort: _sort, ...meal }) => meal);
}

/** Thanksgiving's meals (the original name). */
export const thanksgivingMeals = (resources: CommunityResource[]): HolidayMeal[] => holidayMeals(resources);

/** The other food places in a city (pantries, meal programs), for "See all free food": no holiday's meals. */
export const otherFood = (resources: CommunityResource[]): CommunityResource[] =>
  resources.filter((r) => r.facets.includes('food') && !MEAL_PREFIXES.some((p) => r.name.startsWith(p)));

/**
 * The guide page for where someone is, from the locales the API placed them in (innermost first): the first one that
 * has a help directory, matched by id and then by label. Null when none does.
 */
export function cityFor(cities: ResourceLocale[], placed: { id: string; label?: string | null }[]): string | null {
  for (const locale of placed) {
    const city = cities.find((c) => c.id === locale.id)
      ?? (locale.label ? cities.find((c) => c.label?.toLowerCase() === locale.label?.toLowerCase()) : undefined);
    if (city) return citySlug(city);
  }
  return null;
}

/**
 * When a venue's holiday event is, in the city's time zone: "Wed, Nov 25 · 9pm–2am", or "Thu, Nov 26 · 4pm" with no
 * end. Null without a start.
 */
export function eventWhen(startAt: string | undefined, endAt: string | undefined, timeZone: string | null): string | null {
  if (!startAt) return null;
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) return null;
  const zone = timeZone ?? 'America/New_York';
  const day = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: zone });
  const time = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone })
    .replace(':00', '').replace(' ', '').toLowerCase();
  const end = endAt ? new Date(endAt) : null;
  return `${day} · ${time(start)}${end && !Number.isNaN(end.getTime()) ? `–${time(end)}` : ''}`;
}

// A venue event's price line: free, a cover, or a nudge to check (no price on file).
export function priceText(coverCents: number | undefined): string {
  if (coverCents === 0) return 'Free';
  if (typeof coverCents === 'number') return `$${(coverCents / 100).toFixed(coverCents % 100 ? 2 : 0)} cover`;
  return 'Price not listed. Check with the venue.';
}
