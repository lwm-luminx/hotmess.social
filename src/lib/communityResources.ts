// The community resource directory (audience_kit_api doc/DIGITAL_FLYERS.md) as hotmess.social shows it: food, shelter,
// clinics, crisis lines and DV support in each Hot Mess city, read live from the API's public endpoints
// (GET /v1/audience/:id/community_resources/locales and GET /v1/audience/:id/community_resources?locale_id=).
// Pure helpers only; src/server/publicContent.ts does the fetching.

export interface ResourceLocale { id: string; name: string; label: string | null; country: string | null;
  timeZone: string | null; resourceCount: number }
export interface ResourceSlot { days?: number[]; from?: string | null; until?: string | null; note?: string | null;
  place?: string | null; address?: string | null }
export interface CommunityResource { id: string; title: string; name: string; sensitive: boolean;
  description: string | null; facets: string[]; address: string | null; phone: string | null; textNumber: string | null;
  url: string | null; hours: ResourceSlot[]; sessions: ResourceSlot[]; intakeNote: string | null;
  checkedAt: string | null }
export interface ResourceNeed { key: string; label: string; facets: string[] }
export interface ResourceDirectory { locale: { id: string; name: string }; resources: CommunityResource[];
  needs: ResourceNeed[]; advocacy: string[]; quickExit: string }

const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
const list = <T>(value: unknown, map: (item: Record<string, unknown>) => T): T[] =>
  Array.isArray(value) ? value.filter((item) => item && typeof item === 'object').map((item) => map(item as Record<string, unknown>)) : [];
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

export function resourceLocales(body: unknown): ResourceLocale[] {
  return list((body as { locales?: unknown })?.locales, (l) => ({
    id: String(l.id), name: text(l.name) ?? 'Unnamed city', label: text(l.label), country: text(l.country),
    timeZone: text(l.time_zone), resourceCount: Number(l.resource_count) || 0,
  }));
}

const slot = (s: Record<string, unknown>): ResourceSlot => ({
  days: Array.isArray(s.days) ? s.days.filter((d): d is number => Number.isInteger(d)) : [],
  from: text(s.from), until: text(s.until), note: text(s.note), place: text(s.place), address: text(s.address),
});

export function resourceDirectory(body: unknown): ResourceDirectory {
  const b = (body ?? {}) as Record<string, unknown>;
  const locale = (b.locale ?? {}) as Record<string, unknown>;
  return {
    locale: { id: String(locale.id ?? ''), name: text(locale.name) ?? '' },
    resources: list(b.resources, (r) => ({
      id: String(r.id), title: text(r.title) ?? text(r.name) ?? 'Resource', name: text(r.name) ?? '',
      sensitive: r.sensitive === true, description: text(r.description), facets: strings(r.facets),
      address: text(r.address), phone: text(r.phone), textNumber: text(r.text_number), url: text(r.url),
      hours: list(r.hours, slot), sessions: list(r.sessions, slot), intakeNote: text(r.intake_note),
      checkedAt: text(r.checked_at),
    })),
    needs: list(b.needs, (n) => ({ key: String(n.key), label: text(n.label) ?? String(n.key), facets: strings(n.facets) })),
    advocacy: strings(b.advocacy),
    quickExit: text(b.quick_exit) ?? 'Leave now',
  };
}

/** The path segment for a city: its label, lowercased, else its id. */
export const citySlug = (locale: ResourceLocale): string => (locale.label ?? locale.id).toLowerCase();

export const findCity = (locales: ResourceLocale[], slug: string): ResourceLocale | undefined =>
  locales.find((l) => citySlug(l) === slug.toLowerCase());

const COUNTRIES: Record<string, string> = { US: 'United States', CA: 'Canada', MX: 'Mexico', GB: 'United Kingdom',
  AU: 'Australia' };
const ZONE_COUNTRIES: [RegExp, string][] = [[/^Europe\/London$/, 'GB'], [/^Australia\//, 'AU'],
  [/^America\/(Mexico_City|Cancun|Merida|Monterrey|Mazatlan|Tijuana|Bahia_Banderas|Matamoros|Chihuahua|Hermosillo)$/, 'MX'],
  [/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Montreal|Regina|St_Johns|Moncton)$/, 'CA'],
  [/^(America|Pacific\/Honolulu)/, 'US']];

/** A city's country name, from the API's country or else its time zone. */
export function countryName(locale: ResourceLocale): string {
  const code = locale.country ?? ZONE_COUNTRIES.find(([zone]) => zone.test(locale.timeZone ?? ''))?.[1];
  return (code && COUNTRIES[code]) ?? 'Elsewhere';
}

/** Cities grouped by country, the US first, each group and its cities by name. */
export function byCountry(locales: ResourceLocale[]): { country: string; cities: ResourceLocale[] }[] {
  const groups = new Map<string, ResourceLocale[]>();
  for (const locale of locales) groups.set(countryName(locale), [...(groups.get(countryName(locale)) ?? []), locale]);
  const order = ['United States', 'Canada', 'Mexico', 'United Kingdom', 'Australia', 'Elsewhere'];
  return [...groups.entries()]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([country, cities]) => ({ country, cities: cities.sort((a, b) => a.name.localeCompare(b.name)) }));
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayText(days: number[] = []): string {
  if (days.length === 0 || days.length === 7) return 'Every day';
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (consecutive && sorted.length > 2) return `${DAY_NAMES[sorted[0]]}–${DAY_NAMES[sorted[sorted.length - 1]]}`;
  return sorted.map((d) => DAY_NAMES[d]).join(', ');
}

function clock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')}${suffix}` : `${hour}${suffix}`;
}

/** One line for an hours or sessions entry, e.g. "Mon–Fri 9am–5pm", "Every day, 24 hours". */
export function slotText(s: ResourceSlot): string {
  const days = dayText(s.days);
  const allDay = (!s.from || s.from === '00:00') && (!s.until || s.until === '23:59');
  const times = allDay ? '24 hours' : `${s.from ? clock(s.from) : 'opening'}–${s.until ? clock(s.until) : 'close'}`;
  const where = [s.place, s.address].filter(Boolean).join(', ');
  return [`${days}, ${times}`, where, s.note && !/^24\/7$/i.test(s.note) ? s.note : null].filter(Boolean).join(' · ');
}

/** A tel: or sms: link for a number as the API stores it (digits, maybe a leading +). */
export const dialHref = (number: string, scheme: 'tel' | 'sms' = 'tel'): string =>
  `${scheme}:${number.replace(/[^\d+]/g, '')}`;

/** A number for reading: +1 US/CA numbers as (206) 568-7777, others as stored. */
export function phoneText(number: string): string {
  const digits = number.replace(/\D/g, '');
  if (/^\+?1\d{10}$/.test(number.replace(/[^\d+]/g, '')) && digits.length === 11) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10 && !number.startsWith('+')) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return number;
}

/** The resources that meet a need (any of its facets). */
export const forNeed = (resources: CommunityResource[], need: ResourceNeed): CommunityResource[] =>
  resources.filter((r) => r.facets.some((f) => need.facets.includes(f)));

/** The facet a crisis or any-time line carries; those resources lead the list. */
export const URGENT_FACET = 'crisis';

/**
 * What a resource offers, in a word or two, for the line above its name. A DV or stalking resource says nothing
 * here: its neutral title is all a glance at the screen should give away.
 */
const KINDS: [string, string][] = [['crisis', 'Crisis support'], ['food', 'Food'], ['shelter', 'Shelter'],
  ['health-coverage', 'Health coverage'], ['sti-testing', 'Testing'], ['mental-health', 'Mental health']];
export const kinds = (resource: Pick<CommunityResource, 'facets' | 'sensitive'>): string[] =>
  resource.sensitive ? ['Support'] : KINDS.filter(([facet]) => resource.facets.includes(facet)).map(([, word]) => word);

/** Crisis and any-time lines first, each group in the order the API gave (by name). */
export const urgentFirst = (resources: CommunityResource[]): CommunityResource[] => [
  ...resources.filter((r) => r.facets.includes(URGENT_FACET)),
  ...resources.filter((r) => !r.facets.includes(URGENT_FACET)),
];

/** The needs that have at least one resource in this city, so no choice leads to an empty list. */
export const offeredNeeds = (directory: ResourceDirectory): ResourceNeed[] =>
  directory.needs.filter((need) => forNeed(directory.resources, need).length > 0);

/**
 * What a search on the device looks through: lowercased title, name, description, kinds, badges and address. The
 * search runs in the browser over the list already on the page; nothing typed is sent anywhere.
 */
export const searchText = (resource: CommunityResource): string =>
  [resource.title, resource.name, resource.description, ...kinds(resource),
    ...resource.facets.map((f) => BADGES[f]), resource.address]
    .filter(Boolean).join(' ').toLowerCase();

/** Whether every word of `query` is somewhere in `text` (from ``searchText``). An empty query matches. */
export const matchesSearch = (text: string, query: string): boolean =>
  query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => text.includes(word));

/** The emergency number to offer for a city: 999 in the UK, 000 in Australia, 911 in the US, Canada and Mexico. */
export function emergencyNumber(locale: ResourceLocale): string | null {
  return { 'United Kingdom': '999', Australia: '000', 'United States': '911', Canada: '911', Mexico: '911' }[
    countryName(locale)] ?? null;
}

/** "Checked Nov 25, 2026" for a yyyy-mm-dd date, or null when nobody has checked it yet. */
export function checkedText(checkedAt: string | null): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(checkedAt ?? '');
  if (!match) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `Checked ${months[Number(match[2]) - 1]} ${Number(match[3])}, ${match[1]}`;
}

/** Short words for the badges a resource shows. */
export const BADGES: Record<string, string> = { 'lgbtq-affirming': 'LGBTQ+ affirming', 'youth-safe': 'Youth safe',
  'no-id-required': 'No ID needed', 'faith-based': 'Faith-based' };
