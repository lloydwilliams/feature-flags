/**
 * The 20 largest metropolitan areas across the USA and Canada, combined.
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
 * (2024-2025 estimates). Membership near the 20-item cut-off shifts with the
 * vintage: Vancouver sits at 21 and San Diego at 20, close enough that a
 * different year's estimates could swap them.
 *
 * Only Toronto and Montreal qualify from Canada on a combined ranking - the
 * next Canadian metro, Vancouver, falls just outside the twenty.
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
] as const

export type Site = (typeof METRO_AREAS_BY_POPULATION)[number]

/**
 * Alphabetical, for the picker. Sorted with `localeCompare` rather than by hand
 * so the order cannot drift if a city is added to the list above.
 */
export const SITES: readonly Site[] = [...METRO_AREAS_BY_POPULATION].sort(
  (a, b) => a.localeCompare(b, 'en'),
)
