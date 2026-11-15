// The Hot Mess poster slogan library. The lines live in slogans.json, a copy of the one the AudienceKit console's poster
// builder reads (audience_kit_api app/frontend/components/SloganPoster/slogans.json, served at GET /v1/poster/slogans).
// Don't edit slogans.json here: change it in the API, then `npm run sync-slogans` (CI checks the two match). Lines are
// data, not hard-coded copy: each has a theme, an audience rating and the art it prints with by default. Words
// between asterisks print in the accent colour. Adult-venue lines only appear when the poster is for a venue flagged
// for them.
//
// A line prints in Spanish when it has an `es` version. Only lines whose joke survives translation have one; a pun
// that only works in English (Grindr, IRL/ASL, cheeks) stays English-only and isn't offered on a Spanish poster.

import library from './slogans.json' with { type: 'json' };

export type SloganTheme = 'headline' | 'real_life' | 'more_than_one' | 'everyone_belongs' | 'bilingual' | 'cheeky';
/** English, Spanish, or both on one poster (the English line, then the Spanish one under it). */
export type SloganLanguage = 'en' | 'es' | 'en-es';
export type SloganRating = 'general' | 'adult_venue';
export type ArtKind = 'disco' | 'peach' | 'lips' | 'mic' | 'harness' | 'hymnal';

export interface Slogan {
  id: string;
  theme: SloganTheme;
  rating: SloganRating;
  /** The English line; every line has one. */
  text: string;
  /** The Spanish line, when the joke works in Spanish. */
  es?: string;
  art: ArtKind[];
  /** Review flags shown in the builder, never printed. */
  notes: string[];
  /** Printed small under the line. */
  footnote?: string;
  footnoteEs?: string;
}

export interface SloganLibrary {
  themes: Record<SloganTheme, string>;
  art: Record<ArtKind, string>;
  slogans: Slogan[];
}

/** The library itself; synced from the API's copy (see the top of this file). */
export const LIBRARY = library as SloganLibrary;
export const THEMES = LIBRARY.themes;
export const ART_LABELS = LIBRARY.art;
export const SLOGANS = LIBRARY.slogans;

/**
 * The lines a poster may use: adult-venue lines only for a venue flagged for them, and in Spanish only the lines that
 * have a Spanish version.
 */
export function slogansFor(adultVenue: boolean, language: SloganLanguage = 'en'): Slogan[] {
  return SLOGANS.filter((s) => (adultVenue || s.rating === 'general') && (language === 'en' || !!s.es));
}

/** A line's text in the poster's language, falling back to the English. */
export function sloganText(slogan: Slogan, language: SloganLanguage = 'en'): string {
  return (language === 'es' && slogan.es) || slogan.text;
}

/** On a bilingual poster, the Spanish line printed under the English; null when there's none or it's the same line. */
export function sloganSecondLine(slogan: Slogan, language: SloganLanguage = 'en'): string | null {
  return language === 'en-es' && slogan.es && slogan.es !== slogan.text ? slogan.es : null;
}

export function sloganFootnote(slogan: Slogan, language: SloganLanguage = 'en'): string | undefined {
  return language === 'es' ? slogan.footnoteEs : slogan.footnote;
}

export function sloganById(id: string): Slogan | undefined {
  return SLOGANS.find((s) => s.id === id);
}

export interface PosterWord {
  text: string;
  accent: boolean;
}

/** Splits a line into upper-cased words, marking the ones between asterisks as accent words. */
export function posterWords(text: string): PosterWord[] {
  const words: PosterWord[] = [];
  let accent = false;
  for (const raw of text.trim().split(/\s+/)) {
    const m = raw.match(/^(\*?)(.*?)(\*?)([.,:;?!]*)$/);
    if (!m) continue;
    if (m[1]) accent = true;
    const word = m[2] + m[4];
    if (word) words.push({ text: word.toUpperCase(), accent });
    if (m[3]) accent = false;
  }
  return words;
}

/** The line as plain text, without accent markers. */
export function plainText(text: string): string {
  return text.replace(/\*/g, '');
}
