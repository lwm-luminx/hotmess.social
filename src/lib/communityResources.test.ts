import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byCountry, citySlug, findCity, forNeed, phoneText, resourceDirectory, resourceLocales, slotText, dialHref }
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
