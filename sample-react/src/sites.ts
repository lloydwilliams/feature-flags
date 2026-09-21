/**
 * The 50 largest cities across Canada, the USA, and Mexico, combined.
 *
 * Figures are city proper / municipality, not metropolitan area - which is why
 * Mexico City appears at ~9.2M rather than its ~21M metro figure, and why some
 * US cities you might expect are absent: their city-proper counts fall below
 * the Mexican municipalities that displace them.
 *
 * Sources differ by country: US Census Bureau 2023 estimates, Canada 2021
 * census, Mexico 2020 census (INEGI). Membership near the 50-item cut-off is
 * therefore approximate.
 *
 * Listed here in population order, largest first, to keep that provenance
 * visible. `SITES` is what the UI renders, sorted alphabetically.
 */
const CITIES_BY_POPULATION = [
  'Mexico City',
  'New York',
  'Los Angeles',
  'Toronto',
  'Chicago',
  'Houston',
  'Tijuana',
  'Montreal',
  'León',
  'Puebla',
  'Phoenix',
  'Ecatepec',
  'Philadelphia',
  'Ciudad Juárez',
  'Zapopan',
  'San Antonio',
  'San Diego',
  'Guadalajara',
  'Calgary',
  'Dallas',
  'Monterrey',
  'Nezahualcóyotl',
  'Mexicali',
  'Querétaro',
  'Ottawa',
  'Edmonton',
  'Culiacán',
  'Mérida',
  'Austin',
  'Jacksonville',
  'San Jose',
  'Fort Worth',
  'Aguascalientes',
  'Hermosillo',
  'Chihuahua',
  'Columbus',
  'San Luis Potosí',
  'Cancún',
  'Charlotte',
  'Toluca',
  'Saltillo',
  'Indianapolis',
  'Morelia',
  'Naucalpan',
  'San Francisco',
  'Acapulco',
  'Seattle',
  'Winnipeg',
  'Torreón',
  'Mississauga',
] as const

export type Site = (typeof CITIES_BY_POPULATION)[number]

/**
 * Alphabetical, for the picker. Sorted with `localeCompare` rather than by hand
 * so accented names collate where a reader expects them, and so the order
 * cannot drift if a city is added to the list above.
 */
export const SITES: readonly Site[] = [...CITIES_BY_POPULATION].sort((a, b) =>
  a.localeCompare(b, 'en'),
)
