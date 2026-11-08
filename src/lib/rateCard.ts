// The promoted placement rate card (AudienceKit GET /v1/promoted/rate_card, api/doc/PROMOTED_PLACEMENT.md). The money
// page reads it at build time; the copy in src/data/ is what ships when the API can't answer.
import fallback from '../data/promoted-rate-card.json' with { type: 'json' };

export interface RateCard {
  currency: string;
  slots_per_night: number;
  shown_at_once: number;
  viewer_floor: number;
  max_nights: number;
  venue_nights_per_week: number;
  tiers: { key: string; name: string; description: string; night_cents: number; prices: Record<string, number> }[];
  city_sizes: { key: string; name: string; percent: number }[];
  discounts: { key: string; name: string; description: string; percent: number }[];
}

export async function loadRateCard(apiBase: string): Promise<RateCard> {
  try {
    const response = await fetch(new URL('/v1/promoted/rate_card', apiBase), { signal: AbortSignal.timeout(5000) });
    if (response.ok) return (await response.json()) as RateCard;
  } catch {
    // Offline builds and an API without the rate card yet use the bundled copy.
  }
  return fallback as RateCard;
}

// Whole dollars without cents ($15), otherwise two places ($7.50); free when zero.
export function formatNightPrice(cents: number): string {
  if (cents === 0) return 'Free';
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}
