/// The 30 largest metropolitan areas across the USA and Canada, combined.
///
/// Copied from sample-react's `sites.ts`, which documents the sources and the
/// ranking. The two lists must match: `site` is the flag targeting key, so a
/// city spelled differently here would be a different site to Datadog.
///
/// Listed largest first, to keep that provenance visible. [sites] is what the
/// UI renders, sorted alphabetically.
const _metroAreasByPopulation = [
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
];

/// Alphabetical, for the picker.
final List<String> sites = [..._metroAreasByPopulation]..sort();
