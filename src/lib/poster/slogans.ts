// The poster slogan library. Lines are data, not hard-coded copy: each has a theme, an audience rating and the art it
// prints with by default. Words between asterisks print in the accent colour. Adult-venue lines only appear when the
// poster is for a venue flagged for them.

export type SloganTheme = 'headline' | 'real_life' | 'more_than_one' | 'everyone_belongs' | 'cheeky';
export type SloganRating = 'general' | 'adult_venue';
export type ArtKind = 'disco' | 'peach' | 'lips' | 'mic' | 'harness' | 'hymnal';

export interface Slogan {
  id: string;
  theme: SloganTheme;
  rating: SloganRating;
  text: string;
  art: ArtKind[];
  /** Review flags shown in the builder, never printed. */
  notes: string[];
  /** Printed small under the line. */
  footnote?: string;
}

export const THEMES: Record<SloganTheme, string> = {
  headline: 'Headline',
  real_life: 'Real life beats screen life',
  more_than_one: 'You are more than one thing',
  everyone_belongs: 'Everyone belongs',
  cheeky: 'Cheeky',
};

export const ART_LABELS: Record<ArtKind, string> = {
  disco: 'Disco ball',
  peach: 'Peach',
  lips: 'Cheek kiss',
  mic: 'Karaoke mic',
  harness: 'Harness',
  hymnal: 'Hymnal',
};

export const SLOGANS: Slogan[] = [
  { id: 'beautiful-person', theme: 'headline', rating: 'general', text: "You're a beautiful person, not a *profitable product*.", art: ['disco'], notes: ['Campaign headline'] },
  { id: 'grinding-grindr', theme: 'real_life', rating: 'general', text: '*Grinding* is better than Grindr.', art: ['disco'], notes: ['Legal review before paid media'] },
  { id: 'irl-asl', theme: 'real_life', rating: 'general', text: '*IRL* is better than ASL.', art: ['lips'], notes: [] },
  { id: 'swipe-less', theme: 'real_life', rating: 'general', text: 'Swipe less. *Sweat more.*', art: ['disco'], notes: [] },
  { id: 'screen-time', theme: 'real_life', rating: 'general', text: 'Screen time is not *face time*.', art: ['lips'], notes: [] },
  { id: 'engagement', theme: 'real_life', rating: 'general', text: '*Engagement* is when you leave the app.', art: ['mic'], notes: [] },
  { id: 'conversation', theme: 'real_life', rating: 'general', text: '*Conversation:* the original hookup app.', art: ['lips'], notes: [] },
  { id: 'your-type', theme: 'real_life', rating: 'general', text: "Just because they're your type doesn't mean they're *your match*.", art: ['peach'], notes: [] },
  { id: 'getting-out', theme: 'real_life', rating: 'adult_venue', text: 'Getting out is better than *getting off*.', art: ['disco'], notes: [] },
  { id: 'pervy-pious', theme: 'more_than_one', rating: 'general', text: "Pervy or pious? *There's a night for that.*", art: ['harness', 'hymnal'], notes: [] },
  { id: 'bear-bookworm', theme: 'more_than_one', rating: 'general', text: 'Bear. Bookworm. Ballet fan. *Yes, all at once.*', art: ['hymnal'], notes: [] },
  { id: 'leather-drag', theme: 'more_than_one', rating: 'general', text: "Don't show up in drag on Leather Night. *Find Leather Drag Night.*", art: ['harness'], notes: [] },
  { id: 'leather-thursday', theme: 'more_than_one', rating: 'general', text: 'Oh, *Leather Night* is next Thursday.', art: ['harness'], notes: [] },
  { id: 'harness-hymnal', theme: 'more_than_one', rating: 'general', text: 'Bring a *harness* or bring a *hymnal*, just know which night it is.', art: ['harness', 'hymnal'], notes: ['Utah'] },
  { id: 'friends-season', theme: 'more_than_one', rating: 'general', text: 'Friends for a reason, or friends for a season. *At least a Drag Race season.*', art: ['mic'], notes: [] },
  { id: 'bring-all-of-you', theme: 'everyone_belongs', rating: 'general', text: 'You are a beautiful, complete person. *Bring all of you to tonight.*', art: ['disco'], notes: [] },
  { id: 'not-mining', theme: 'everyone_belongs', rating: 'general', text: "We're not mining you. *We're meeting you.*", art: ['lips'], notes: [] },
  { id: 'broke-fabulous', theme: 'everyone_belongs', rating: 'general', text: '*Broke and fabulous* are not opposites.', art: ['disco'], notes: [] },
  { id: 'sober-vibe', theme: 'everyone_belongs', rating: 'general', text: 'Sober is a *vibe*, not a verdict.', art: ['mic'], notes: [] },
  { id: 'tags-doors', theme: 'everyone_belongs', rating: 'general', text: 'Tags *open doors*. They never close them.', art: ['disco'], notes: [] },
  { id: 'say-hi', theme: 'everyone_belongs', rating: 'general', text: "Say hi. *Worst case, you've said hi.*", art: ['lips'], notes: [] },
  { id: 'ask-their-name', theme: 'everyone_belongs', rating: 'adult_venue', text: 'Make friends. *Maybe even ask their name.*', art: ['lips'], notes: [] },
  { id: 'cheeky-every-sense', theme: 'cheeky', rating: 'general', text: '*Cheeky* in every sense.', art: ['peach', 'lips'], notes: ['Brand line'] },
  { id: 'little-cheek', theme: 'cheeky', rating: 'general', text: 'A little *cheek* goes a long way.', art: ['lips'], notes: [] },
  { id: 'other-cheek', theme: 'cheeky', rating: 'general', text: 'Turn the other cheek. *Then shake it.*', art: ['peach', 'hymnal'], notes: ['Pairs with the harness/hymnal line'] },
  { id: 'cheek-kisses', theme: 'cheeky', rating: 'general', text: 'Come for the cheek kisses. *Stay for the cheeks.*', art: ['lips', 'peach'], notes: [] },
  { id: 'grab-a-cheek', theme: 'cheeky', rating: 'adult_venue', text: 'Be cheeky. Get a kiss on the cheek. *Maybe grab a cheek.*', art: ['peach', 'lips'], notes: ['Frame as consensual flirting'], footnote: 'Ask first. Every time.' },
];

/** The lines a poster may use: adult-venue lines only for a venue flagged for them. */
export function slogansFor(adultVenue: boolean): Slogan[] {
  return SLOGANS.filter((s) => adultVenue || s.rating === 'general');
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
