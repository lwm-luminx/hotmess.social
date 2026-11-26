// Your privacy choices on the web (the API's doc/PRIVACY_CHOICES.md): the same choices, words and rules as the apps
// (audience-kit-sdk's PrivacyChoicesCopy). The browser's own Global Privacy Control signal (Sec-GPC: 1) reaches the API
// on every signed-in request and counts as an opt-out there; nothing here has to send it.

import type { Website } from 'audience-kit';

// The shapes and the documents are the SDK's (audience-kit's Website client); this file keeps the words and the rules.
export type PrivacyChoiceKey = Website.PrivacyChoiceKey;
export type PrivacyOffer = Website.PrivacyOffer;
export type PrivacyChoices = Website.PrivacyChoices;

export const KNOWN: readonly PrivacyChoiceKey[] = ['SALE_SHARE_OPT_OUT', 'AD_MEASUREMENT', 'PERSONALIZED_ADS', 'PRIVACY_PASS'];

export const TITLE = 'Your privacy choices';

export const intro = (appName: string) =>
  `These choices are for ${appName} only. Turning something off is as easy as turning it on, and none of the free choices ever costs anything.`;

export const LABELS: Record<PrivacyChoiceKey, string> = {
  SALE_SHARE_OPT_OUT: 'Do not sell or share my personal information',
  AD_MEASUREMENT: 'Count me in sponsors’ viewer numbers',
  PERSONALIZED_ADS: 'Ads based on my activity',
  PRIVACY_PASS: 'Privacy pass',
};

export function detail(key: PrivacyChoiceKey, appName: string): string {
  switch (key) {
    case 'SALE_SHARE_OPT_OUT': return `${appName} doesn’t sell your personal information or share it for advertising. Turn this on and it never will, whatever changes.`;
    case 'AD_MEASUREMENT': return 'Sponsors only ever see how many different people saw their card each week, never who. Turn this off and you aren’t counted.';
    case 'PERSONALIZED_ADS': return 'Off unless you turn it on. While it’s off, ads are chosen only by the screen, the place and the night, never by anything about you.';
    case 'PRIVACY_PASS': return 'No Promoted or Sponsored cards, and none of your data used for ads, for a while.';
  }
}

export const FROM_GPC = 'Turned on by your browser’s Global Privacy Control signal.';

/** The offer's choices this page knows, in the API's order. */
export const known = (offer: PrivacyOffer) => offer.choices.filter((key) => KNOWN.includes(key));

/** The web takes the pass wherever the audience sells one (the apps only in US storefronts). */
export const passOffered = (offer: PrivacyOffer) => offer.choices.includes('PRIVACY_PASS') && offer.passCents != null;

export function money(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export const passButton = (cents: number, days: number) => `Go without ads for ${days} days, ${money(cents)}`;

export const passExplanation = (days: number) =>
  `For ${days} days you’ll see no Promoted or Sponsored cards, and none of your data is used for ads or counted for sponsors. You pay once; nothing renews. The free choices above stay free either way.`;

export function isOn(choices: PrivacyChoices, key: PrivacyChoiceKey): boolean {
  switch (key) {
    case 'SALE_SHARE_OPT_OUT': return choices.saleShareOptedOut;
    case 'AD_MEASUREMENT': return choices.adMeasurement;
    case 'PERSONALIZED_ADS': return choices.personalizedAds;
    case 'PRIVACY_PASS': return choices.privacyPassUntil != null;
  }
}

/** The variables that turn one switch: only that choice, the same call both ways. */
export function variablesFor(key: PrivacyChoiceKey, on: boolean): Record<string, boolean> {
  switch (key) {
    case 'SALE_SHARE_OPT_OUT': return { saleShareOptOut: on };
    case 'AD_MEASUREMENT': return { adMeasurement: on };
    case 'PERSONALIZED_ADS': return { personalizedAds: on };
    case 'PRIVACY_PASS': return {};
  }
}

/** Whether this browser sends a Global Privacy Control signal. */
export function browserSendsGPC(): boolean {
  return typeof navigator !== 'undefined' && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}
