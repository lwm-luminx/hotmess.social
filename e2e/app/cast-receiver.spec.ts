import { test, expect, type Page } from '@playwright/test';
import { venueShortLink } from '../../src/lib/venueShortLink';

// The Velvet cast receiver (/cast/velvet), with Google's Cast receiver SDK replaced by a stand-in, so it runs here
// the way a Chromecast runs it: Velvet on a phone sends the board over urn:x-cast:com.audiencekit.velvet, and when
// the last phone leaves the TV falls back to the venue's web sign. The stand-in records what the page registers and
// lets each test send a message or drop a sender, as the Cast framework would.
const NS = 'urn:x-cast:com.audiencekit.velvet';
const VENUE_ID = '11111111-1111-4111-8111-111111111111';

const CAF_STUB = `
window.castStub = { listeners: {}, events: {}, senders: 1, started: null };
window.cast = { framework: {
  system: { MessageType: { JSON: 'json' }, EventType: { SENDER_DISCONNECTED: 'senderdisconnected' } },
  CastReceiverOptions: function () {},
  CastReceiverContext: { getInstance: function () { return {
    addCustomMessageListener: function (ns, fn) { castStub.listeners[ns] = fn; },
    addEventListener: function (type, fn) { castStub.events[type] = fn; },
    getSenders: function () { return new Array(castStub.senders); },
    start: function (options) { castStub.started = options; },
  }; } },
} };`;

async function open(page: Page) {
  await page.route('https://www.gstatic.com/cast/**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: CAF_STUB }));
  await page.goto('/cast/velvet');
  await page.waitForFunction(() => typeof (window as any).velvetQR === 'function');
}

async function send(page: Page, data: unknown) {
  await page.evaluate(([ns, message]) => (window as any).castStub.listeners[ns as string]({ data: message }), [NS, data]);
}

const board = {
  type: 'tonight',
  venue: { id: VENUE_ID, name: 'Neighbours', timeZone: 'America/Los_Angeles' },
  events: ['Mess Hall', 'Late Show'],
  lineup: [
    { id: '1', name: 'Opening DJ', role: 'DJ', time: '9:00 PM', state: 'done', images: [] },
    { id: '2', name: 'Lola Bunny', role: 'Performer', time: '10:00 PM', state: 'on',
      images: ['https://example.com/lola.jpg', 'http://insecure.example.com/x.jpg'] },
    { id: '3', name: 'Host Name', role: 'Host Name', time: '~11:00 PM', state: 'upcoming', images: [] },
  ],
};

test('starts the Cast receiver on Velvet’s namespace, idle until a phone sends tonight', async ({ page }) => {
  await open(page);
  const started = await page.evaluate(() => (window as any).castStub.started);
  expect(started).toMatchObject({ disableIdleTimeout: true, skipPlayersLoad: true, statusText: 'Tonight' });
  expect(Object.keys(started.customNamespaces)).toEqual([NS]);
  await expect(page.locator('#board .idle')).toHaveText('Pick this TV in Velvet’s Tonight tab.');
  await expect(page.locator('#chat')).toBeHidden();
  // A message of another kind leaves the screen alone.
  await send(page, { type: 'other', venue: board.venue });
  await expect(page.locator('#board .idle')).toHaveText('Pick this TV in Velvet’s Tonight tab.');
});

test('shows the venue, tonight’s events and the lineup the phone sends', async ({ page }) => {
  await open(page);
  await send(page, board);
  await expect(page.locator('#board h1')).toHaveText('Neighbours');
  await expect(page.locator('#board .events')).toHaveText('Mess Hall · Late Show');
  const rows = page.locator('#board .lineup li');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toHaveClass('done');
  await expect(rows.nth(1)).toHaveClass('on');
  await expect(rows.nth(1).locator('.badge')).toHaveText('On now');
  await expect(rows.nth(2)).toHaveClass('upcoming');
  await expect(rows.nth(2).locator('.time')).toHaveText('~11:00 PM');
  // Only https images are drawn; a role that repeats the name is left off.
  await expect(rows.nth(1).locator('img')).toHaveCount(1);
  await expect(rows.nth(1).locator('small')).toHaveText('Performer');
  await expect(rows.nth(2).locator('small')).toHaveCount(0);
  await expect(page.locator('#chat')).toBeHidden();
  await expect(page.locator('#board .clock')).not.toBeEmpty();
});

test('the join QR code is the venue’s short link, or the link the phone sends', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const w = window as any; const draw = w.velvetQR; w.qrTexts = [];
    w.velvetQR = (text: string) => { w.qrTexts.push(text); return draw(text); };
  });
  await send(page, board);
  await expect(page.locator('header .join svg')).toBeVisible();
  // Same code as src/lib/venueShortLink.ts (and audience_kit_api VenueShortLink) for this ID.
  await send(page, { ...board, join: 'https://hotmess.social/venues/abc/chat' });
  await send(page, { ...board, join: 'https://evil.example.com/' });
  const texts = await page.evaluate(() => (window as any).qrTexts);
  expect(texts).toEqual([venueShortLink(VENUE_ID), 'https://hotmess.social/venues/abc/chat']);
  await expect(page.locator('header .join')).toHaveCount(0);
});

/** A picture of the given size for the backdrop's sharpness check (an SVG's width and height are its natural size). */
async function picture(page: Page, url: string, width: number, height: number) {
  await page.route(url, (route) => route.fulfill({ contentType: 'image/svg+xml',
    body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#405"/></svg>` }));
}

test('a night with nothing on shows the venue’s photo and says so', async ({ page }) => {
  await open(page);
  await picture(page, 'https://example.com/room.jpg', 1920, 1080);
  await send(page, { ...board, events: [], lineup: [], venue: { ...board.venue, photo: 'https://example.com/room.jpg' } });
  await expect(page.locator('#board .idle')).toHaveText('Nothing on tonight yet.');
  await expect(page.locator('#board')).toHaveClass(/photo/);
  expect(await page.locator('#board').evaluate((el) => el.style.backgroundImage)).toContain('https://example.com/room.jpg');
  await send(page, { ...board, events: ['Mess Hall'], lineup: [], venue: { ...board.venue, photo: 'javascript:alert(1)' } });
  await expect(page.locator('#board .idle')).toHaveText('The lineup is coming soon.');
  await expect(page.locator('#board')).not.toHaveClass(/photo/);
});

test('a photo too small to fill the TV without blurring stays off the backdrop', async ({ page }) => {
  await open(page);
  await picture(page, 'https://example.com/small.jpg', 640, 360);
  await send(page, { ...board, events: [], lineup: [], venue: { ...board.venue, photo: 'https://example.com/small.jpg' } });
  await expect(page.locator('#board .idle')).toHaveText('Nothing on tonight yet.');
  await page.waitForTimeout(500);
  await expect(page.locator('#board')).not.toHaveClass(/photo/);
});

test('shows the room’s chat in the right third when the phone sends it, as text only', async ({ page }) => {
  await open(page);
  await send(page, { ...board, chat: { pinned: 'Drag brunch Sunday', messages: [
    { sender: 'Sam', text: '<b>hi</b> everyone', venue: false, avatar: 'https://example.com/sam.jpg' },
    { sender: 'Neighbours', text: 'Welcome in', venue: true },
    { sender: 'Kai', text: '📷 Photo', venue: false, photo: 'https://example.com/p.jpg' },
  ] } });
  const chat = page.locator('#chat');
  await expect(chat).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/with-chat/);
  await expect(page.locator('#pinned')).toHaveText('📌 Drag brunch Sunday');
  const rows = page.locator('#messages li');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).locator('p')).toHaveText('<b>hi</b> everyone');
  await expect(rows.nth(0).locator('b')).toHaveCount(1);
  await expect(rows.nth(1)).toHaveClass('venue');
  await expect(rows.nth(1).locator('.initial')).toHaveText('N');
  await expect(rows.nth(2).locator('img.photo')).toHaveAttribute('src', 'https://example.com/p.jpg');
  await expect(rows.nth(2).locator('p')).toHaveCount(0);
  const width = await page.evaluate(() => document.getElementById('chat')!.offsetWidth / window.innerWidth);
  expect(width).toBeCloseTo(1 / 3, 1);
  // An empty room asks guests to say hi; a board without chat takes the column away.
  await send(page, { ...board, chat: { messages: [] } });
  await expect(page.locator('#messages li.empty')).toHaveText('Say hi in Hot Mess.');
  await expect(page.locator('#pinned')).toBeHidden();
  await send(page, board);
  await expect(chat).toBeHidden();
});

test('a TV set to one thing by Velvet Display shows only that', async ({ page }) => {
  await open(page);
  const room = { messages: [{ sender: 'Sam', text: 'hello', venue: false }] };
  const posters = [{ id: 'e1', name: 'Drag Bingo', when: 'Tomorrow · 9 PM', billing: '', cover: 'Free', image: null,
    link: 'https://hotmess.social/events/e1' }];
  // The chat wall: the room across the whole screen, no board, no slides.
  await send(page, { ...board, chat: room, slogans: { adult: false }, posters, mode: 'chat' });
  await expect(page.locator('body')).toHaveClass(/mode-chat/);
  await expect(page.locator('#board')).toBeHidden();
  await expect(page.locator('#messages li p')).toHaveText('hello');
  const width = await page.evaluate(() => document.getElementById('chat')!.offsetWidth / window.innerWidth);
  expect(width).toBeGreaterThan(0.95);
  // The lineup alone leaves the chat off even when it's sent.
  await send(page, { ...board, chat: room, mode: 'lineup' });
  await expect(page.locator('#chat')).toBeHidden();
  await expect(page.locator('#board .lineup li')).toHaveCount(3);
  // Posters only: straight to a poster, with the board out of sight behind it.
  await send(page, { ...board, chat: room, posters, mode: 'posters' });
  await expect(page.locator('body')).toHaveClass(/mode-posters/);
  await expect(page.locator('#chat')).toBeHidden();
  await expect(page.locator('.event-poster .name')).toHaveText('Drag Bingo');
  await expect(page.locator('.event-poster')).toBeVisible();
  // A mode it can't fill shows the board: chat without a room, posters without posters.
  await send(page, { ...board, mode: 'chat' });
  await expect(page.locator('body')).not.toHaveClass(/mode-chat/);
  await expect(page.locator('#board')).toBeVisible();
  await send(page, { ...board, mode: 'posters' });
  await expect(page.locator('body')).not.toHaveClass(/mode-posters/);
});

test('a night without a lineup lists what’s coming up, and the song playing runs along the bottom', async ({ page }) => {
  await open(page);
  await send(page, {
    ...board, lineup: [],
    comingUp: [{ name: 'No Theme Saturday', when: 'Sat 9:00 PM' }, { name: 'Sunday Karaoke', when: 'Sun 9:00 PM' }],
    nowPlaying: { title: 'Toxic', artist: 'Britney Spears', artwork: 'https://example.com/toxic.jpg' },
  });
  await expect(page.locator('#board .idle')).toHaveText('The lineup is coming soon.');
  await expect(page.locator('#board .coming li')).toHaveCount(2);
  await expect(page.locator('#board .coming li').first()).toContainText('No Theme Saturday');
  await expect(page.locator('#board .now-playing strong')).toHaveText('Toxic');
  await expect(page.locator('#board .now-playing')).toContainText('Britney Spears');
});

test('a TV set to sing-along lyrics follows the song’s clock, line by line', async ({ page }) => {
  await open(page);
  const lyrics = {
    title: 'Defying Gravity', artist: 'Idina Menzel', position: 12.6, playing: false,
    lines: [{ t: 10, text: 'Something has changed within me' }, { t: 12.5, text: 'Something is not the same' },
      { t: 15, text: 'I’m through with playing by the rules' }],
  };
  await send(page, { ...board, mode: 'lyrics', lyrics });
  await expect(page.locator('#board')).toBeHidden();
  await expect(page.locator('#lyrics')).toBeVisible();
  await expect(page.locator('#lyrics .song')).toHaveText('Defying Gravity · Idina Menzel');
  await expect(page.locator('#lyrics li.now')).toHaveText('Something is not the same');
  await expect(page.locator('#lyrics li.past')).toHaveText('Something has changed within me');
  await send(page, { type: 'clock', position: 15.2, playing: false });
  await expect(page.locator('#lyrics li.now')).toHaveText('I’m through with playing by the rules');
  // Without lyrics, the TV shows the board.
  await send(page, { ...board, mode: 'lyrics' });
  await expect(page.locator('#lyrics')).toBeHidden();
  await expect(page.locator('#board .lineup li')).toHaveCount(3);
});

test('a TV set to the photo wall shows the photographers’ photos, credited, and turns them over', async ({ page }) => {
  await page.clock.install();
  await open(page);
  const photos = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => ({
    id, url: `https://example.com/${id}.jpg`, credit: i < 3 ? 'Ana Lens' : 'Bo Flash',
    caption: id === 'a' ? 'Encore at Mess Hall' : undefined,
  }));
  photos.push({ id: 'x', url: 'http://insecure.example.com/x.jpg', credit: 'Nope', caption: undefined });
  await send(page, { ...board, mode: 'photos', photos, chat: { messages: [{ sender: 'Sam', text: 'hi', venue: false }] } });
  await expect(page.locator('#board')).toBeHidden();
  await expect(page.locator('#chat')).toBeHidden();
  await expect(page.locator('#photos')).toBeVisible();
  await expect(page.locator('#photos .tile')).toHaveCount(5);
  await expect(page.locator('#photos .tile.large img')).toHaveAttribute('src', 'https://example.com/a.jpg');
  await expect(page.locator('#photos .tile.large figcaption')).toContainText('Encore at Mess Hall');
  await expect(page.locator('#photos .venue-name')).toHaveText('Neighbours');
  await expect(page.locator('#photos .credit')).toHaveText('Photos by Ana Lens and Bo Flash');
  await expect(page.locator('#photos img[src^="http://"]')).toHaveCount(0);
  // Every 12 seconds the next photo leads.
  await page.clock.runFor(12_500);
  await expect(page.locator('#photos .tile.large img')).toHaveAttribute('src', 'https://example.com/b.jpg');
  // The same list again doesn't start the wall over.
  await send(page, { ...board, mode: 'photos', photos });
  await expect(page.locator('#photos .tile.large img')).toHaveAttribute('src', 'https://example.com/b.jpg');
  // With no photos, the TV shows the board.
  await send(page, { ...board, mode: 'photos', photos: [] });
  await expect(page.locator('#photos')).toBeHidden();
  await expect(page.locator('#board .lineup li')).toHaveCount(3);
});

test('when the last phone leaves, the TV keeps going on the venue’s public web sign, without chat', async ({ page }) => {
  await open(page);
  await send(page, { ...board, chat: { messages: [{ sender: 'Sam', text: 'hi', venue: false }] } });
  await expect(page.locator('#chat')).toBeVisible();
  // One phone of two leaving changes nothing.
  await page.evaluate(() => { const s = (window as any).castStub; s.senders = 1; s.events.senderdisconnected(); });
  await expect(page.locator('#chat')).toBeVisible();
  await expect(page.locator('#board h1')).toHaveText('Neighbours');
  const display = page.waitForResponse((r) => r.url().endsWith(`/venues/${VENUE_ID}/display`));
  await page.evaluate(() => { const s = (window as any).castStub; s.senders = 0; s.events.senderdisconnected(); });
  expect((await display).status()).toBe(200);
  await expect(page.locator('#chat')).toBeHidden();
  await expect(page.locator('#board')).toContainText('DJ Fallback');
  // A phone coming back takes the TV over again.
  await send(page, board);
  await expect(page.locator('#board .lineup li')).toHaveCount(3);
  await expect(page.locator('#board')).not.toContainText('DJ Fallback');
});
