// Rotates slides over a venue board: the lineup for BOARD_SECONDS, then one slide full screen for SLIDE_SECONDS. The
// slides take turns: an upcoming event's poster (eventPosters.ts), then a slogan (marquee.ts), taking the lines in a
// shuffled order so a long night doesn't loop the same few; either stands in when the other has none. The web sign and
// the Velvet cast receiver run it; `set` turns the slogans on (with whether the venue's adult lines may show) or off,
// and `posters` sets the events' posters, which show whether or not the slogans are on. `social` sets the venue's social
// media profiles (social.ts): a "follow us" slide with a code to each, once after every round of the posters (or in
// their place when there are none).

import qrcode from 'qrcode-generator';
import { BOARD_SECONDS, SLIDE_SECONDS, slidesFor, type MarqueeManifest, type MarqueeSlide } from './marquee.ts';
import { nextPoster, posterKicker, type EventPoster } from './eventPosters.ts';
import type { SocialProfile } from './social.ts';

export interface SloganRotation {
  /** Slides on, with the venue's adult lines or not; null turns them off and takes any slide down. */
  set(slogans: { adult: boolean } | null): void;
  /** Upcoming events' posters, already cleaned (eventPosters); [] for none. */
  posters(posters: EventPoster[]): void;
  /** Posters back to back with no board or slogans between (a TV set to show only posters). */
  postersOnly(on: boolean): void;
  /** The venue's social profiles (already cleaned, socialProfiles) and its name, for the follow-us slide; [] for none. */
  social(profiles: SocialProfile[], venueName?: string | null): void;
}

export function sloganRotation(screen: HTMLElement): SloganRotation {
  let manifest: Promise<MarqueeManifest | null> | null = null;
  let adult: boolean | null = null;
  let queue: MarqueeSlide[] = [];
  let posters: EventPoster[] = [];
  let lastPoster: string | null = null;
  let postersTurn = false;
  let only = false;
  let social: SocialProfile[] = [];
  let socialVenue = '';
  let socialDue = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const slide = document.createElement('div');
  slide.className = 'slogan-slide';
  slide.hidden = true;
  const image = document.createElement('img');
  image.alt = '';
  slide.appendChild(image);
  screen.appendChild(slide);
  const poster = document.createElement('div');
  poster.className = 'event-poster';
  poster.hidden = true;
  poster.setAttribute('aria-hidden', 'true');
  screen.appendChild(poster);
  const follow = document.createElement('div');
  follow.className = 'social-slide';
  follow.hidden = true;
  follow.setAttribute('aria-hidden', 'true');
  screen.appendChild(follow);

  const running = () => adult !== null || posters.length > 0 || social.length > 0;

  function load(): Promise<MarqueeManifest | null> {
    manifest ??= fetch('/marquee/slogans.json').then((r) => (r.ok ? r.json() as Promise<MarqueeManifest> : null)).catch(() => null);
    return manifest;
  }

  async function refill() {
    const all = await load();
    if (!all || adult === null) return;
    queue = slidesFor(all, adult).map((s) => ({ s, k: Math.random() })).sort((a, b) => a.k - b.k).map(({ s }) => s);
  }

  function hide() {
    slide.hidden = true;
    poster.hidden = true;
    follow.hidden = true;
    document.body.classList.remove('showing-slogan');
  }

  function up() {
    document.body.classList.add('showing-slogan');
    timer = setTimeout(() => { hide(); schedule(); }, SLIDE_SECONDS * 1000);
  }

  function el(tag: string, className: string, text?: string): HTMLElement {
    const node = document.createElement(tag);
    node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /** The event's poster: its banner behind, what and when, who and the cover, and a code to the event. */
  function draw(event: EventPoster) {
    poster.textContent = '';
    poster.classList.toggle('pictured', !!event.image);
    if (event.image) poster.style.setProperty('--banner', `url("${event.image.replace(/["\\\n]/g, '')}")`);
    else poster.style.removeProperty('--banner');
    const words = el('div', 'words');
    words.appendChild(el('p', 'kicker', posterKicker(event)));
    words.appendChild(el('h2', 'name', event.name));
    if (event.when) words.appendChild(el('p', 'when', event.when));
    if (event.billing) words.appendChild(el('p', 'billing', event.billing));
    if (event.cover) words.appendChild(el('p', 'cover', event.cover));
    poster.appendChild(words);
    const qr = qrcode(0, 'M');
    qr.addData(event.link);
    qr.make();
    const code = el('div', 'code');
    const box = el('div', 'qr');
    box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    code.appendChild(box);
    code.appendChild(el('p', 'scan', 'Scan for details'));
    poster.appendChild(code);
  }

  /** The follow-us slide: the venue's name and each network with its handle and a code to the profile. */
  function drawSocial() {
    follow.textContent = '';
    const words = el('div', 'words');
    words.appendChild(el('p', 'kicker', 'Follow us'));
    words.appendChild(el('h2', 'name', socialVenue || 'Follow us'));
    follow.appendChild(words);
    const cards = el('div', 'cards');
    for (const profile of social) {
      const card = el('div', 'card');
      const qr = qrcode(0, 'M');
      qr.addData(profile.url);
      qr.make();
      const box = el('div', 'qr');
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      card.appendChild(box);
      card.appendChild(el('p', 'network', profile.network));
      card.appendChild(el('p', 'handle', profile.handle));
      cards.appendChild(card);
    }
    follow.appendChild(cards);
  }

  /** The follow-us slide, up straight away (it has no pictures to wait for); false without profiles. */
  function showSocial(): boolean {
    if (!social.length) return false;
    socialDue = false;
    drawSocial();
    follow.hidden = false;
    up();
    return true;
  }

  /** The next event's poster, up once its banner is in (or straight away without one); false with none. After the last
   * poster of a round, or in place of posters when there are none, the follow-us slide takes the turn. */
  function showPoster(): boolean {
    if (social.length && (socialDue || !posters.length)) return showSocial();
    const event = nextPoster(posters, lastPoster);
    if (!event) return false;
    lastPoster = event.id;
    if (social.length && event.id === posters[posters.length - 1].id) socialDue = true;
    draw(event);
    const reveal = () => {
      if (!running()) return;
      poster.hidden = false;
      up();
    };
    if (!event.image) { reveal(); return true; }
    const banner = new Image();
    banner.onload = reveal;
    // A banner that won't load leaves the poster on its words.
    banner.onerror = () => { poster.classList.remove('pictured'); poster.style.removeProperty('--banner'); reveal(); };
    banner.src = event.image;
    return true;
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(show, only ? 0 : BOARD_SECONDS * 1000);
  }

  async function show() {
    if (!running()) return;
    if (only) {
      // None to show: look again after the board's turn rather than spinning.
      if (!showPoster()) timer = setTimeout(show, BOARD_SECONDS * 1000);
      return;
    }
    postersTurn = !postersTurn;
    if (postersTurn && showPoster()) return;
    if (await showSlogan()) return;
    if (!postersTurn && showPoster()) return;
    schedule();
  }

  /** The next slogan, up once its picture is in, so the TV never shows half a slide; false with none. */
  async function showSlogan(): Promise<boolean> {
    if (adult === null) return false;
    if (!queue.length) await refill();
    const upNext = queue.shift();
    if (!upNext || adult === null) return false;
    image.onload = () => {
      if (!running()) return;
      slide.hidden = false;
      up();
    };
    image.onerror = () => schedule();
    image.src = upNext.image;
    return true;
  }

  function stopOrStart() {
    if (!running()) {
      if (timer) clearTimeout(timer);
      timer = null;
      hide();
    } else if (slide.hidden && poster.hidden && follow.hidden && !timer) {
      schedule();
    }
  }

  return {
    set(slogans) {
      const wanted = slogans ? slogans.adult : null;
      if (wanted === adult) return;
      adult = wanted;
      queue = [];
      if (adult === null && !slide.hidden) { if (timer) clearTimeout(timer); timer = null; hide(); }
      stopOrStart();
    },
    posters(list) {
      posters = list;
      stopOrStart();
    },
    postersOnly(on) {
      if (on === only) return;
      only = on;
      // Straight to a poster (or back to the board's pace) rather than waiting out the board's turn.
      if (slide.hidden && poster.hidden && follow.hidden && running()) schedule();
    },
    social(profiles, venueName) {
      social = profiles;
      socialVenue = venueName ?? '';
      if (!social.length) socialDue = false;
      stopOrStart();
    },
  };
}
