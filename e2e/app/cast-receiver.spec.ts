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

test('a night with nothing on shows the venue’s photo and says so', async ({ page }) => {
  await open(page);
  await send(page, { ...board, events: [], lineup: [], venue: { ...board.venue, photo: 'https://example.com/room.jpg' } });
  await expect(page.locator('#board .idle')).toHaveText('Nothing on tonight yet.');
  await expect(page.locator('#board')).toHaveClass(/photo/);
  expect(await page.locator('#board').evaluate((el) => el.style.backgroundImage)).toContain('https://example.com/room.jpg');
  await send(page, { ...board, events: ['Mess Hall'], lineup: [], venue: { ...board.venue, photo: 'javascript:alert(1)' } });
  await expect(page.locator('#board .idle')).toHaveText('The lineup is coming soon.');
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
