// Slogan slides for a venue's TV: the poster lines at 16:9 with the app download code, which the web sign
// (/venues/<id>/display), the Velvet cast receiver (/cast/velvet) and Velvet's AirPlay marquee rotate in between looks
// at tonight's lineup, unless the venue turned them off. They're drawn once with the poster engine
// (scripts/marquee-slides.mjs) into public/marquee/, so a Chromecast or a phone only shows a picture; the manifest
// there is what the screens read. Adult-venue lines only show at a venue flagged for adult content.

import { SLOGANS, type Slogan } from './slogans.ts';
import type { StyleKey } from './render.ts';

export interface MarqueeSlide {
  id: string;
  /** An adult-venue line: shown only where the venue is flagged for adult content. */
  adult: boolean;
  /** Its picture, 1920 × 1080, from the site root. */
  image: string;
}

export interface MarqueeManifest {
  slides: MarqueeSlide[];
}

/** How long a screen shows the lineup before a slide, and how long the slide stays up, in seconds. */
export const BOARD_SECONDS = 45;
export const SLIDE_SECONDS = 12;

const LOOK_CYCLE: StyleKey[] = ['neon', 'glitter', 'sticker', 'riso'];

/** The lines a TV may show: every line but one still waiting on legal review before it goes out as media. */
export function marqueeSlogans(): Slogan[] {
  return SLOGANS.filter((s) => !s.notes.some((note) => /legal review/i.test(note)));
}

/** Each line's look on the TV, taking turns so one slide doesn't look like the last. */
export function marqueeLook(index: number): StyleKey {
  return LOOK_CYCLE[index % LOOK_CYCLE.length];
}

/** The picture a line is drawn into; the look is in the name, so a new look is a new address. */
export function slideImage(id: string, look: StyleKey): string {
  return `/marquee/${id}-${look}.jpg`;
}

/** The manifest the screens read: every TV line, in library order. */
export function marqueeManifest(): MarqueeManifest {
  return {
    slides: marqueeSlogans().map((s, i) => ({ id: s.id, adult: s.rating === 'adult_venue', image: slideImage(s.id, marqueeLook(i)) })),
  };
}

/** The slides a venue's TV shows: the adult-venue ones only where the venue is flagged for them. */
export function slidesFor(manifest: MarqueeManifest, adult: boolean): MarqueeSlide[] {
  return manifest.slides.filter((s) => adult || !s.adult);
}
