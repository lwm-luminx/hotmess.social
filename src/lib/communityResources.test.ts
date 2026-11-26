import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byCountry, checkedText, citySlug, emergencyNumber, findCity, forNeed, kinds, matchesSearch, offeredNeeds,
  phoneText, resourceDirectory, resourceLocales, searchText, slotText, dialHref, urgentFirst }
  from './communityResources.ts';

const locales = resourceLocales({ locales: [
  { id: 'a', name: 'Seattle', label: 'Seattle', time_zone: 'America/Los_Angeles', resource_count: 9 },
  { id: 'b', name: 'Toronto', label: 'toronto', time_zone: 'America/Toronto', resource_count: 8 },
  { id: 'c', name: 'London', label: null, country: 'GB', time_zone: 'Europe/London', resource_count: 7 },
  { id: 'd', name: 'Austin', label: 'austin', time_zone: 'America/Chicago', resource_count: 6 },
] });

test('cities group by country, the US first, by name within', () => {
  assert.deepEqual(byCountry(locales).map((g) => [g.country, g.cities.map((c) => c.name)]), [
    ['United States', ['Austin', 'Seattle']], ['Canada', ['Toronto']], ['United Kingdom', ['London']],
  ]);
});

test('a city is found by its lowercased label, or its id without one', () => {
  assert.equal(citySlug(locales[0]), 'seattle');
  assert.equal(findCity(locales, 'Seattle')?.id, 'a');
  assert.equal(findCity(locales, 'c')?.name, 'London');
  assert.equal(findCity(locales, 'nowhere'), undefined);
});

test('hours read as people say them', () => {
  assert.equal(slotText({ days: [1, 2, 3, 4, 5], from: '09:00', until: '17:00' }), 'Mon–Fri, 9am–5pm');
  assert.equal(slotText({ days: [], from: '00:00', until: '23:59', note: '24/7' }), 'Every day, 24 hours');
  assert.equal(slotText({ days: [3], from: '18:30', until: null, place: 'Church hall' }), 'Wed, 6:30pm–close · Church hall');
  assert.equal(slotText({ days: [2, 4] }), 'Tue, Thu, 24 hours');
});

test('numbers dial and read cleanly', () => {
  assert.equal(dialHref('+1 (206) 568-7777'), 'tel:+12065687777');
  assert.equal(dialHref('741741', 'sms'), 'sms:741741');
  assert.equal(phoneText('+12065687777'), '(206) 568-7777');
  assert.equal(phoneText('8019782452'), '(801) 978-2452');
  assert.equal(phoneText('988'), '988');
  assert.equal(phoneText('+442073001234'), '+442073001234');
});

test('a directory keeps the neutral title and filters by need', () => {
  const directory = resourceDirectory({
    locale: { id: 'a', name: 'Seattle' }, quick_exit: 'Leave now', advocacy: ['You deserve better.'],
    needs: [{ key: 'safe', label: "I don't feel safe at home", facets: ['dv-stalking'] }],
    resources: [
      { id: '1', title: 'Support line', name: 'The NW Network', sensitive: true, facets: ['dv-stalking'], hours: [] },
      { id: '2', title: 'Food bank', name: 'Food bank', facets: ['food'], hours: 'bad' },
    ],
  });
  assert.equal(directory.resources[0].title, 'Support line');
  assert.equal(directory.resources[0].sensitive, true);
  assert.deepEqual(directory.resources[1].hours, []);
  assert.deepEqual(forNeed(directory.resources, directory.needs[0]).map((r) => r.id), ['1']);
});

const browsed = resourceDirectory({ locale: { id: 'a', name: 'Salt Lake' }, needs: [
  { key: 'food', label: 'Food', facets: ['food'] }, { key: 'shelter', label: 'Shelter', facets: ['shelter'] },
  { key: 'safe', label: 'Safety at home', facets: ['dv-stalking'] }],
resources: [
  { id: '1', title: 'Calvary pantry', name: 'Calvary pantry', sensitive: false, facets: ['food', 'no-id-required'],
    description: 'Thursday groceries.', address: '460 W Century Dr', checked_at: '2026-11-15' },
  { id: '2', title: 'Crisis Care Center', name: 'Crisis Care Center', sensitive: false, facets: ['crisis', 'mental-health'] },
  { id: '3', title: 'Support line', name: 'YWCA Utah', sensitive: true, facets: ['dv-stalking', 'crisis'] },
] });

test('crisis lines lead the list, and only needs with something listed are offered', () => {
  assert.deepEqual(urgentFirst(browsed.resources).map((r) => r.id), ['2', '3', '1']);
  assert.deepEqual(offeredNeeds(browsed).map((n) => n.key), ['food', 'safe']);
});

test('a resource says what it offers in a word or two, and a DV resource stays neutral', () => {
  assert.deepEqual(kinds(browsed.resources[0]), ['Food']);
  assert.deepEqual(kinds(browsed.resources[1]), ['Crisis support', 'Mental health']);
  assert.deepEqual(kinds(browsed.resources[2]), ['Support']);
});

test('search looks through names, descriptions, kinds, badges and addresses, every word', () => {
  const pantry = searchText(browsed.resources[0]);
  assert.ok(matchesSearch(pantry, ''));
  assert.ok(matchesSearch(pantry, '  Thursday FOOD '));
  assert.ok(matchesSearch(pantry, 'no id'));
  assert.ok(matchesSearch(pantry, 'century'));
  assert.ok(!matchesSearch(pantry, 'food shelter'));
  assert.ok(matchesSearch(searchText(browsed.resources[2]), 'ywca'));
});

test('the emergency number follows the country, and is left out where we do not know it', () => {
  assert.equal(emergencyNumber(locales[0]), '911');
  assert.equal(emergencyNumber(locales[2]), '999');
  assert.equal(emergencyNumber({ ...locales[2], country: 'FR', timeZone: 'Europe/Paris' }), null);
});

test('a checked date reads as a date, and an unchecked one says nothing', () => {
  assert.equal(checkedText('2026-11-15'), 'Checked Nov 15, 2026');
  assert.equal(checkedText(null), null);
});
