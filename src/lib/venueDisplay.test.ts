import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entryName, entryRole, entryTime, venueTonight, visibleLineup, type DisplayEntry } from './venueDisplay.ts';

const entry = (over: Partial<DisplayEntry>): DisplayEntry => ({ id: 'a', kind: 'act', role: 'performer', title: null,
  people: [], more: 0, startsAt: null, startTiming: 'none', state: 'upcoming', ...over });

test('reads the API body, keeping only known values', () => {
  const tonight = venueTonight({ venue: { id: 'v', title: 'Kremwerk', time_zone: 'America/New_York' }, night: '2026-10-23',
    events: [{ id: 'e', name: 'Drag Brunch' }],
    lineup: [{ id: 'x', kind: 'mystery', role: 'dj', people: [{ name: 'Kiki' }, { name: '' }], more: 1,
      starts_at: '2026-10-24T03:00:00Z', start_timing: 'hard', state: 'on' }] });
  assert.equal(tonight.venue.timeZone, 'America/New_York');
  assert.deepEqual(tonight.events, [{ id: 'e', name: 'Drag Brunch', startAt: undefined }]);
  assert.equal(tonight.lineup[0].kind, 'act');
  assert.deepEqual(tonight.lineup[0].people, [{ name: 'Kiki', image: undefined }]);
  assert.equal(tonight.lineup[0].state, 'on');
});

test('names only Public performers and counts the rest', () => {
  assert.equal(entryName(entry({ people: [{ name: 'Kiki Riot' }], more: 2 })), 'Kiki Riot + 2 more');
  assert.equal(entryName(entry({ people: [{ name: 'A' }, { name: 'B' }] })), 'A & B');
  assert.equal(entryName(entry({ more: 1, role: 'dj' })), 'DJ');
  assert.equal(entryName(entry({ more: 3 })), '3 performers');
  assert.equal(entryName(entry({ kind: 'intermission' })), 'Intermission');
  assert.equal(entryName(entry({ kind: 'segment', title: 'Photos with cast' })), 'Photos with cast');
  assert.equal(entryRole(entry({ role: 'host' })), 'Host');
  assert.equal(entryRole(entry({ kind: 'intermission', role: null })), '');
});

test('shows set times in the venue zone, soft ones with a tilde', () => {
  const at = '2026-10-24T04:30:00Z';
  assert.equal(entryTime(entry({ startsAt: at, startTiming: 'hard' }), 'America/Los_Angeles'), '9:30 PM');
  assert.equal(entryTime(entry({ startsAt: at, startTiming: 'soft' }), 'America/Los_Angeles'), '~9:30 PM');
  assert.equal(entryTime(entry({ startsAt: at }), 'America/Los_Angeles'), '');
  assert.equal(entryTime(entry({ startsAt: at, state: 'on' }), 'America/Los_Angeles'), '9:30 PM');
});

test('keeps what is on and next, and finished sets only while there is room', () => {
  const lineup = ['d1', 'd2', 'd3', 'on', 'n1', 'n2'].map((id) =>
    entry({ id, state: id.startsWith('d') ? 'done' : id === 'on' ? 'on' : 'upcoming' }));
  assert.deepEqual(visibleLineup(lineup, 4).map((e) => e.id), ['d3', 'on', 'n1', 'n2']);
  assert.deepEqual(visibleLineup(lineup, 2).map((e) => e.id), ['on', 'n1']);
});
