// Weighting these callsign prefixes has been a journey...
// Originally, I weighted them based on rough analysis found here:
// https://github.com/sc0tfree/morsewalker/issues/8#issuecomment-2585349244
// However, as Mike N4FFF pointed out, this doesn't feel right, nor does it match
// the actual distribution of callsign prefixes in our logs.
// So, Mike suggested a much better approach, documented here:
// https://github.com/sc0tfree/morsewalker/issues/29
export const US_CALLSIGN_PREFIXES_WEIGHTED = [
  // Large items
  { value: 'K', weight: 40 }, // 40%
  { value: 'W', weight: 25 }, // 25%
  { value: 'N', weight: 20 }, // 20%

  // Smaller items
  { value: 'AA', weight: 2 }, // 2%
  { value: 'AB', weight: 2 }, // 2%
  { value: 'AC', weight: 2 }, // 2%
  { value: 'AD', weight: 1 }, // 1%
  { value: 'AE', weight: 1 }, // 1%
  { value: 'AF', weight: 1 }, // 1%
  { value: 'AG', weight: 1 }, // 1%
  { value: 'AH', weight: 1 }, // 1%
  { value: 'AI', weight: 1 }, // 1%
  { value: 'AJ', weight: 1 }, // 1%
  { value: 'AK', weight: 1 }, // 1%
  { value: 'AL', weight: 1 }, // 1%
];

export const NON_US_CALLSIGN_PREFIXES = [
  '9A',
  'CT',
  'DL',
  'E',
  'EA',
  'EI',
  'ES',
  'EU',
  'F',
  'G',
  'GM',
  'GW',
  'HA',
  'HB',
  'I',
  'JA',
  'LA',
  'LU',
  'LY',
  'LZ',
  'OE',
  'OH',
  'OK',
  'OM',
  'ON',
  'OZ',
  'PA',
  'PY',
  'S',
  'SM',
  'SP',
  'SV',
  'UA',
  'UR',
  'VE',
  'VK',
  'YO',
  'YT',
];
