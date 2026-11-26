// The Thanksgiving food guide (/thanksgiving and /thanksgiving/<city>): a shareable page that leads with a city's free
// Thanksgiving Day meals and shows how to find free food in Hot Mess. The meals are ordinary community resources named
// "Thanksgiving meal: <org> (<city>)", loaded for the day and hidden after it (audience_kit_api, Thanksgiving 2026), so
// this page reads the same live directory as /resources/<city>. Pure helpers only.
import type { CommunityResource, ResourceLocale, ResourceSlot } from './communityResources';
import { citySlug } from './communityResources.ts';

export const MEAL_PREFIX = 'Thanksgiving meal: ';

export interface ThanksgivingMeal {
  id: string; org: string; time: string | null; address: string | null; phone: string | null; url: string | null;
  intakeNote: string | null; description: string | null;
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
export const mealOrg = (name: string): string =>
  name.slice(MEAL_PREFIX.length).replace(/\s*\([^()]*\)\s*$/, '').trim() || name;

/** A city's Thanksgiving Day meals, earliest first. */
export function thanksgivingMeals(resources: CommunityResource[]): ThanksgivingMeal[] {
  return resources
    .filter((r) => r.name.startsWith(MEAL_PREFIX))
    .map((r) => {
      const slot = r.sessions[0] ?? r.hours[0];
      return { id: r.id, org: mealOrg(r.name), time: mealTime(slot), start: slot?.from ?? '99:99',
        address: r.address, phone: r.phone, url: r.url, intakeNote: r.intakeNote, description: r.description };
    })
    .sort((a, b) => a.start.localeCompare(b.start) || a.org.localeCompare(b.org))
    .map(({ start: _start, ...meal }) => meal);
}

/** The other food places in a city (pantries, meal programs), for "See all free food". */
export const otherFood = (resources: CommunityResource[]): CommunityResource[] =>
  resources.filter((r) => r.facets.includes('food') && !r.name.startsWith(MEAL_PREFIX));

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
