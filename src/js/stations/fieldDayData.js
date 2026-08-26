/**
 * ARRL/RAC section abbreviations published for ARRL contests.
 *
 * Source:
 * https://contests.arrl.org/contestmultipliers.php?a=wve
 */
const sections = (...values) => Object.freeze(values);

export const ARRL_SECTIONS_BY_LOCATION = Object.freeze({
  AL: sections('AL'),
  AK: sections('AK'),
  AZ: sections('AZ'),
  AR: sections('AR'),
  CA: sections('EB', 'LAX', 'ORG', 'SB', 'SCV', 'SDG', 'SF', 'SJV', 'SV'),
  CO: sections('CO'),
  CT: sections('CT'),
  DE: sections('DE'),
  DC: sections('MDC'),
  FL: sections('NFL', 'SFL', 'WCF'),
  GA: sections('GA'),
  HI: sections('PAC'),
  ID: sections('ID'),
  IL: sections('IL'),
  IN: sections('IN'),
  IA: sections('IA'),
  KS: sections('KS'),
  KY: sections('KY'),
  LA: sections('LA'),
  ME: sections('ME'),
  MD: sections('MDC'),
  MA: sections('EMA', 'WMA'),
  MI: sections('MI'),
  MN: sections('MN'),
  MS: sections('MS'),
  MO: sections('MO'),
  MT: sections('MT'),
  NE: sections('NE'),
  NV: sections('NV'),
  NH: sections('NH'),
  NJ: sections('NNJ', 'SNJ'),
  NM: sections('NM'),
  NY: sections('ENY', 'NLI', 'NNY', 'WNY'),
  NC: sections('NC'),
  ND: sections('ND'),
  OH: sections('OH'),
  OK: sections('OK'),
  OR: sections('OR'),
  PA: sections('EPA', 'WPA'),
  PR: sections('PR'),
  RI: sections('RI'),
  SC: sections('SC'),
  SD: sections('SD'),
  TN: sections('TN'),
  TX: sections('NTX', 'STX', 'WTX'),
  UT: sections('UT'),
  VT: sections('VT'),
  VA: sections('VA'),
  VI: sections('VI'),
  WA: sections('EWA', 'WWA'),
  WV: sections('WV'),
  WI: sections('WI'),
  WY: sections('WY'),
});

export const ARRL_SECTIONS = Object.freeze([
  ...new Set(Object.values(ARRL_SECTIONS_BY_LOCATION).flat()),
]);

export const RAC_SECTIONS = Object.freeze([
  'AB',
  'BC',
  'GH',
  'MB',
  'NB',
  'NL',
  'NS',
  'ONE',
  'ONN',
  'ONS',
  'PE',
  'QC',
  'SK',
  'TER',
]);

const DX_SECTIONS = Object.freeze(['DX']);
const VALID_SECTIONS = new Set([
  ...ARRL_SECTIONS,
  ...RAC_SECTIONS,
  ...DX_SECTIONS,
]);

/**
 * A compact approximation of the classes reported by CW-active stations in
 * the official 2025 Field Day results. Common low-number classes dominate,
 * while uncommon larger operations remain possible.
 *
 * Source:
 * https://contests.arrl.org/ContestResults/2025/field-day-2025.csv
 */
const FIELD_DAY_CLASSES_WEIGHTED = Object.freeze([
  { value: '1D', weight: 27 },
  { value: '3A', weight: 12 },
  { value: '1B', weight: 12 },
  { value: '1E', weight: 11 },
  { value: '2A', weight: 10 },
  { value: '4A', weight: 8 },
  { value: '5A', weight: 4 },
  { value: '1A', weight: 3 },
  { value: '6A', weight: 2 },
  { value: '2F', weight: 2 },
  { value: '3F', weight: 1 },
  { value: '2E', weight: 1 },
  { value: '2B', weight: 1 },
  { value: '7A', weight: 1 },
  { value: '1C', weight: 1 },
  { value: '8A', weight: 1 },
  { value: '23A', weight: 1 },
  { value: '4F', weight: 1 },
  { value: '3E', weight: 1 },
]);

const CANADIAN_CALLSIGN_PREFIXES = Object.freeze(['VA', 'VE', 'VO', 'VY']);

/**
 * Tests the on-air Field Day class syntax.
 *
 * Battery and commercial-power entry suffixes are intentionally excluded:
 * they are submission categories, not part of the transmitted exchange.
 *
 * @param {unknown} value - Candidate Field Day class.
 * @returns {boolean} Whether the value is a positive count followed by A-F.
 */
export function isValidFieldDayClass(value) {
  return /^[1-9]\d*[A-F]$/.test(
    String(value ?? '')
      .trim()
      .toUpperCase()
  );
}

/**
 * Tests a current ARRL/RAC section abbreviation or DX.
 *
 * @param {unknown} value - Candidate section.
 * @returns {boolean} Whether the normalized value is a valid section.
 */
export function isValidFieldDaySection(value) {
  return VALID_SECTIONS.has(
    String(value ?? '')
      .trim()
      .toUpperCase()
  );
}

/**
 * Generates the class and section carried by every calling station.
 *
 * Two random draws are always consumed: one for class and one for section,
 * including DX's single-value section pool.
 *
 * @param {Object} station - Base calling-station identity.
 * @param {string} station.callsign - Generated callsign.
 * @param {boolean} station.isUS - Whether the callsign was generated as US.
 * @param {string} station.state - Generated US state/location code.
 * @returns {{fieldDayClass: string, fieldDaySection: string}} Exchange fields.
 */
export function generateFieldDayData({ callsign, isUS, state }) {
  const locationSections =
    ARRL_SECTIONS_BY_LOCATION[String(state ?? '').toUpperCase()];
  const sectionPool = isUS
    ? (locationSections ?? ARRL_SECTIONS)
    : hasCanadianPrefix(callsign)
      ? RAC_SECTIONS
      : DX_SECTIONS;

  return {
    fieldDayClass: weightedRandomElement(FIELD_DAY_CLASSES_WEIGHTED),
    fieldDaySection: randomElement(sectionPool),
  };
}

/**
 * Tests whether a callsign starts with a Canadian amateur prefix.
 *
 * @param {string} callsign - Normalized callsign.
 * @returns {boolean} Whether the call is Canadian.
 */
function hasCanadianPrefix(callsign) {
  return CANADIAN_CALLSIGN_PREFIXES.some((prefix) =>
    String(callsign).startsWith(prefix)
  );
}

/**
 * Selects a uniformly random array element.
 *
 * @param {Array} values - Candidate values.
 * @returns {*} One selected value.
 */
function randomElement(values) {
  return values[Math.floor(Math.random() * values.length)];
}

/**
 * Selects a value from weighted entries.
 *
 * @param {Array<Object>} values - Weighted candidate values.
 * @returns {*} One selected value.
 */
function weightedRandomElement(values) {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  let draw = Math.random() * totalWeight;

  for (const item of values) {
    draw -= item.weight;
    if (draw <= 0) return item.value;
  }

  return values[values.length - 1].value;
}
