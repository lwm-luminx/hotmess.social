import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOLIDAYS, cityFor, eventStillOn, holidayMeals, holidayNow, mealOrg, mealTime, otherFood, priceText, thanksgivingMeals } from './holidayGuide.ts';
import type { CommunityResource, ResourceLocale } from './communityResources.ts';

const resource = (over: Partial<CommunityResource>): CommunityResource => ({
  id: 'r', title: 'R', name: 'R', sensitive: false, description: null, facets: ['food'], address: null, phone: null,
  textNumber: null, url: null, hours: [], sessions: [], intakeNote: null, checkedAt: null, ...over,
});

test('mealTime gives a window, an open end, or nothing', () => {
  assert.equal(mealTime({ days: [4], from: '07:00', until: '15:00' }), '7am–3pm');
  assert.equal(mealTime({ days: [4], from: '11:30', until: null }), 'From 11:30am');
  assert.equal(mealTime({ days: [4], from: '12:00', until: '13:30' }), '12pm–1:30pm');
  assert.equal(mealTime(undefined), null);
});

test('mealOrg drops the prefix and the city', () => {
  assert.equal(mealOrg('Thanksgiving meal: GLIDE (San Francisco)'), 'GLIDE');
  assert.equal(mealOrg("Thanksgiving meal: The Lord's Diner (N Broadway) (Wichita)"), "The Lord's Diner (N Broadway)");
});

test('thanksgivingMeals keeps only the day’s meals, earliest first', () => {
  const meals = thanksgivingMeals([
    resource({ id: 'b', name: 'Thanksgiving meal: Late (X)', sessions: [{ days: [4], from: '14:00', until: '16:00' }] }),
    resource({ id: 'p', name: 'Food pantry' }),
    resource({ id: 'a', name: 'Thanksgiving meal: Early (X)', sessions: [{ days: [4], from: '07:00', until: '15:00' }] }),
  ]);
  assert.deepEqual(meals.map((m) => [m.id, m.org, m.time]), [['a', 'Early', '7am–3pm'], ['b', 'Late', '2pm–4pm']]);
});

test('christmas meals carry their day and sort Eve before Day', () => {
  const meals = holidayMeals([
    resource({ id: 'd', name: 'Christmas meal: Day Dinner (X)', sessions: [{ days: [5], from: '11:00', until: '14:00' }] }),
    resource({ id: 't', name: 'Thanksgiving meal: Old (X)', sessions: [{ days: [4], from: '07:00', until: '15:00' }] }),
    resource({ id: 'e', name: 'Christmas meal: Eve Supper (X)', sessions: [{ days: [4], from: '17:00', until: '19:00' }] }),
  ], HOLIDAYS.christmas);
  assert.deepEqual(meals.map((m) => [m.id, m.org, m.day, m.time]), [
    ['e', 'Eve Supper', 'Christmas Eve, Thu Dec 24', '5pm–7pm'], ['d', 'Day Dinner', 'Christmas Day, Fri Dec 25', '11am–2pm']]);
  assert.equal(mealOrg('Christmas meal: GLIDE (San Francisco)', HOLIDAYS.christmas.mealPrefix), 'GLIDE');
});

test('otherFood leaves every holiday’s meals out', () => {
  const rows = otherFood([resource({ id: 'm', name: 'Thanksgiving meal: A (X)' }), resource({ id: 'c', name: 'Christmas meal: B (X)' }), resource({ id: 'p', name: 'Pantry' }),
    resource({ id: 's', name: 'Shelter', facets: ['shelter'] })]);
  assert.deepEqual(rows.map((r) => r.id), ['p']);
});

test('cityFor takes the first placed locale with a directory, by id then label', () => {
  const cities: ResourceLocale[] = [
    { id: '1', name: 'Salt Lake', label: 'slc', country: 'US', timeZone: null, resourceCount: 12 },
    { id: '2', name: 'Miami', label: 'Miami', country: 'US', timeZone: null, resourceCount: 9 },
  ];
  assert.equal(cityFor(cities, [{ id: '9', label: 'district' }, { id: '1' }]), 'slc');
  assert.equal(cityFor(cities, [{ id: '7', label: 'miami' }]), 'miami');
  assert.equal(cityFor(cities, [{ id: '8', label: 'nowhere' }]), null);
});

test('eventWhen reads in the city time zone', async () => {
  const { eventWhen } = await import('./holidayGuide.ts');
  assert.equal(eventWhen('2026-11-26T04:00:00Z', '2026-11-26T09:00:00Z', 'America/Denver'), 'Wed, Nov 25 · 9pm–2am');
  assert.equal(eventWhen('2026-11-26T21:30:00Z', undefined, 'America/New_York'), 'Thu, Nov 26 · 4:30pm');
  assert.equal(eventWhen(undefined, undefined, null), null);
});

test('priceText', () => {
  assert.equal(priceText(0), 'Free');
  assert.equal(priceText(1000), '$10 cover');
  assert.equal(priceText(1250), '$12.50 cover');
  assert.equal(priceText(undefined), 'Price not listed. Check with the venue.');
});

test('holidayNow keeps the holiday’s own words until it ends, then stops saying today', () => {
  const during = holidayNow(HOLIDAYS.thanksgiving, new Date('2026-11-26T20:00:00Z'));
  assert.equal(during.over, false);
  assert.match(during.mealsTitle, /today/);
  const after = holidayNow(HOLIDAYS.thanksgiving, new Date('2026-11-27T12:00:00Z'));
  assert.equal(after.over, true);
  assert.doesNotMatch(`${after.lede} ${after.mealsTitle} ${after.noMeals('Salt Lake')}`, /today/);
  assert.equal(after.next, 'christmas');
});

test('eventStillOn drops an event once it has ended, or six hours in when it lists no end', () => {
  const now = new Date('2026-11-27T08:00:00Z');
  assert.equal(eventStillOn('2026-11-26T23:00:00Z', '2026-11-27T03:00:00Z', now), false);
  assert.equal(eventStillOn('2026-11-27T00:00:00Z', null, now), false);
  assert.equal(eventStillOn('2026-11-27T05:00:00Z', null, now), true);
  assert.equal(eventStillOn('2026-12-24T23:00:00Z', '2026-12-25T04:00:00Z', now), true);
  assert.equal(eventStillOn(null, null, now), true);
});
