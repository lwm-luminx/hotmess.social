// A street address as the poster prints it: the street on one line and the town on the next, instead of the whole
// thing squeezed onto one line in tiny type (Rick, 2026-11-15). Pure, so it tests with node --test.

const COUNTRIES = /^(usa|us|u\.s\.a?\.?|united states( of america)?|united kingdom|uk|australia|canada|mexico|méxico|españa|spain)$/i;

/**
 * "1234 Pike St, Seattle, WA 98101, USA" as ["1234 Pike St", "Seattle, WA 98101"]. The country is left off (the poster
 * hangs in it). A place with no comma, such as a city's name, stays one line.
 */
export function addressLines(address: string): string[] {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length > 2 && COUNTRIES.test(parts[parts.length - 1])) parts.pop();
  if (parts.length < 2) return parts;
  return [parts[0], parts.slice(1).join(', ')];
}
