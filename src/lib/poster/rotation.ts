// Rotates the slogan slides (marquee.ts) over a venue board: the lineup for BOARD_SECONDS, then one slide full screen
// for SLIDE_SECONDS, taking the lines in a shuffled order so a long night doesn't loop the same few. The web sign and
// the Velvet cast receiver run it; `set` turns it on (with whether the venue's adult lines may show) or off.

import { BOARD_SECONDS, SLIDE_SECONDS, slidesFor, type MarqueeManifest, type MarqueeSlide } from './marquee.ts';

export interface SloganRotation {
  /** Slides on, with the venue's adult lines or not; null turns them off and takes any slide down. */
  set(slogans: { adult: boolean } | null): void;
}

export function sloganRotation(screen: HTMLElement): SloganRotation {
  let manifest: Promise<MarqueeManifest | null> | null = null;
  let adult: boolean | null = null;
  let queue: MarqueeSlide[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const slide = document.createElement('div');
  slide.className = 'slogan-slide';
  slide.hidden = true;
  const image = document.createElement('img');
  image.alt = '';
  slide.appendChild(image);
  screen.appendChild(slide);

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
    document.body.classList.remove('showing-slogan');
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(show, BOARD_SECONDS * 1000);
  }

  async function show() {
    if (adult === null) return;
    if (!queue.length) await refill();
    const upNext = queue.shift();
    if (!upNext || adult === null) return schedule();
    // Only once the picture is in, so the TV never shows half a slide.
    image.onload = () => {
      if (adult === null) return;
      slide.hidden = false;
      document.body.classList.add('showing-slogan');
      timer = setTimeout(() => { hide(); schedule(); }, SLIDE_SECONDS * 1000);
    };
    image.onerror = () => schedule();
    image.src = upNext.image;
  }

  return {
    set(slogans) {
      const wanted = slogans ? slogans.adult : null;
      if (wanted === adult) return;
      adult = wanted;
      queue = [];
      if (adult === null) {
        if (timer) clearTimeout(timer);
        timer = null;
        hide();
      } else if (slide.hidden) {
        schedule();
      }
    },
  };
}
