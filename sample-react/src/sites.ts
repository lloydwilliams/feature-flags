/**
 * The 30 largest metropolitan areas across the USA and Canada, combined.
 *
 * Metro area, not city proper - so Dallas ranks above Philadelphia, and
 * Riverside makes the list on the strength of the Inland Empire rather than the
 * city's own size. Each entry is named for the metro's principal city, which is
 * what a site picker wants: "Dallas" rather than "Dallas-Fort Worth",
 * "Riverside" rather than "Inland Empire".
 *
 * Sources: US Census Bureau Metropolitan Statistical Areas and Statistics
 * Canada Census Metropolitan Areas, via
 * https://en.wikipedia.org/wiki/List_of_North_American_metropolitan_areas_by_population
 * (2024-2025 estimates). Ordered by the published population figures rather
 * than by that page's rank column, which numbers Mexican metros inline.
 *
 * Three Canadian metros qualify on a combined ranking: Toronto at 6, Montreal
 * at 15, Vancouver at 21. Calgary, Edmonton, and Ottawa all fall outside the
 * thirty. Membership at the cut-off is tight - Sacramento takes the last place
 * at ~2.46M with Pittsburgh at ~2.43M just behind, so a different vintage of
 * the estimates could swap them.
 *
 * Listed here largest first, to keep that provenance visible. `SITES` is what
 * the UI renders, sorted alphabetically.
 */
const METRO_AREAS_BY_POPULATION = [
  'New York',
  'Los Angeles',
  'Chicago',
  'Dallas',
  'Houston',
  'Toronto',
  'Atlanta',
  'Washington',
  'Miami',
  'Philadelphia',
  'Phoenix',
  'Boston',
  'Riverside',
  'San Francisco',
  'Montreal',
  'Detroit',
  'Seattle',
  'Minneapolis',
  'Tampa',
  'San Diego',
  'Vancouver',
  'Denver',
  'Orlando',
  'Charlotte',
  'Baltimore',
  'St. Louis',
  'San Antonio',
  'Austin',
  'Portland',
  'Sacramento',
] as const

export type Site = (typeof METRO_AREAS_BY_POPULATION)[number]

/**
 * Alphabetical, for the picker. Sorted with `localeCompare` rather than by hand
 * so the order cannot drift if a city is added to the list above.
 */
export const SITES: readonly Site[] = [...METRO_AREAS_BY_POPULATION].sort(
  (a, b) => a.localeCompare(b, 'en'),
)
