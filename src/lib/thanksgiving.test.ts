import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cityFor, mealOrg, mealTime, otherFood, thanksgivingMeals } from './thanksgiving.ts';
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

test('otherFood leaves the meals out', () => {
  const rows = otherFood([resource({ id: 'm', name: 'Thanksgiving meal: A (X)' }), resource({ id: 'p', name: 'Pantry' }),
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
