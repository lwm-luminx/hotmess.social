// The words a slogan poster prints besides its line: the footer and the QR code's caption, in English, Spanish, or
// both on one poster. The same words as the console's poster builder (audience_kit_api Poster/i18n.ts).
import type { SloganLanguage } from './slogans.ts';

export interface PosterStrings {
  tagline: string;
  getApp: (app: string) => string;
  freeOnPhones: string;
  findYourPeople: string;
  scanToOpen: (app: string) => string;
  scanToDownload: string;
}

const EN: PosterStrings = {
  tagline: 'find your night',
  getApp: (app) => `Get ${app}`,
  freeOnPhones: 'Free on iPhone and Android',
  findYourPeople: 'Find your people tonight',
  scanToOpen: (app) => `Scan to open it in ${app} →`,
  scanToDownload: 'Scan to download →',
};

const ES: PosterStrings = {
  tagline: 'encuentra tu noche',
  getApp: (app) => `Descarga ${app}`,
  freeOnPhones: 'Gratis en iPhone y Android',
  findYourPeople: 'Encuentra a tu gente esta noche',
  scanToOpen: (app) => `Escanea para abrirlo en ${app} →`,
  scanToDownload: 'Escanea para descargar →',
};

// Both on one line, "English · Español"; the QR caption stays short.
const BOTH: PosterStrings = {
  tagline: `${EN.tagline} · ${ES.tagline}`,
  getApp: (app) => `${EN.getApp(app)} · ${ES.getApp(app)}`,
  freeOnPhones: `${EN.freeOnPhones} · ${ES.freeOnPhones}`,
  findYourPeople: `${EN.findYourPeople} · ${ES.findYourPeople}`,
  scanToOpen: () => 'Scan · Escanea →',
  scanToDownload: 'Scan · Escanea →',
};

export function posterStrings(language: SloganLanguage = 'en'): PosterStrings {
  return language === 'en-es' ? BOTH : language === 'es' ? ES : EN;
}

/** The language picker's choices. */
export const LANGUAGES: { value: SloganLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'en-es', label: 'English / Español' },
];
