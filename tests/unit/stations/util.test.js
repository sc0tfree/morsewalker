/* @vitest-environment jsdom */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const dependencies = vi.hoisted(() => ({
  createMorsePlayer: vi.fn(),
  getCallingStation: vi.fn(),
  updateAudioLock: vi.fn(),
}));

vi.mock('../../../src/js/audio.js', () => ({
  createMorsePlayer: dependencies.createMorsePlayer,
  updateAudioLock: dependencies.updateAudioLock,
}));

vi.mock('../../../src/js/stationGenerator.js', () => ({
  getCallingStation: dependencies.getCallingStation,
}));

let addStations;
let compareStrings;
let weightedRandom;

async function loadAppHtml() {
  const html = await readFile(resolve(process.cwd(), 'src/index.html'), 'utf8');
  document.open();
  document.write(html);
  document.close();
}

beforeAll(async () => {
  await loadAppHtml();
  ({ addStations, compareStrings, weightedRandom } = await import(
    '../../../src/js/util.js'
  ));
});

beforeEach(async () => {
  await loadAppHtml();
  dependencies.createMorsePlayer.mockReset();
  dependencies.getCallingStation.mockReset();
  dependencies.updateAudioLock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const compareCases = [
  // Perfect-match examples.
  ['perfect', 'ABC', 'ABC', 'perfect'],
  ['perfect empty strings', '', '', 'perfect'],
  ['perfect one character', 'A', 'A', 'perfect'],

  // Criterion 1: a query that is an exact prefix of the source.
  ['criterion 1 one-character prefix', 'ABC', 'A', 'partial'],
  ['criterion 1 two-character prefix', 'ABC', 'AB', 'partial'],
  ['criterion 1 wrong second character', 'ABC', 'AX', 'none'],
  [
    'criterion 1 documented miss falls through to criterion 5',
    'ABC',
    'ABX',
    'partial',
  ],
  ['criterion 1 wrong first character', 'ABC', 'Z', 'none'],
  ['criterion 1 empty query', 'ABC', '', 'none'],
  ['criterion 1 three-character prefix', 'ABCDE', 'ABC', 'partial'],
  ['criterion 1 four-character prefix', 'ABCDE', 'ABCD', 'partial'],

  // Criterion 2: at least two exact characters in the middle or at the end.
  ['criterion 2 suffix', 'ABC', 'BC', 'partial'],
  ['criterion 2 middle pair', 'ABCDE', 'CD', 'partial'],
  ['criterion 2 ending pair', 'ABCDE', 'DE', 'partial'],
  [
    'criterion 2 documented miss is accepted earlier as a prefix',
    'ABCDE',
    'AB',
    'partial',
  ],
  ['criterion 2 one middle character', 'ABCDE', 'B', 'none'],
  ['criterion 2 one ending character', 'ABCDE', 'E', 'none'],
  ['criterion 2 exact source', 'ABCDE', 'ABCDE', 'perfect'],
  ['criterion 2 absent run', 'ABCDE', 'XYZ', 'none'],
  ['criterion 2 middle triple', 'ABCDE', 'BCD', 'partial'],
  ['criterion 2 ending quadruple', 'ABCDE', 'BCDE', 'partial'],

  // Criterion 3: one substitution in a query of four or more characters.
  ['criterion 3 shifted substitution', 'ABCDE', 'BCZE', 'partial'],
  ['criterion 3 query too short', 'ABCDE', 'BCE', 'none'],
  ['criterion 3 leading-window substitution', 'ABCDE', 'ABXD', 'partial'],
  ['criterion 3 two substitutions', 'ABCDE', 'ABXY', 'none'],
  ['criterion 3 exact source', 'ABCDE', 'ABCDE', 'perfect'],
  ['criterion 3 internal substitution', 'ABCDE', 'ABCXE', 'partial'],
  ['criterion 3 final substitution', 'ABCDE', 'ABCDF', 'partial'],
  ['criterion 3 exact shorter prefix', 'ABCDE', 'ABCD', 'partial'],
  ['criterion 3 one substitution at equal length', 'ABCDE', 'ABXDE', 'partial'],
  ['criterion 3 two substitutions at equal length', 'ABCDE', 'ABXXE', 'none'],

  // Criterion 4: the full source is an exact prefix of a longer query.
  ['criterion 4 one extra character', 'ABC', 'ABCD', 'partial'],
  ['criterion 4 two extra characters', 'ABC', 'ABCDE', 'partial'],
  ['criterion 4 arbitrary extra character', 'ABC', 'ABCX', 'partial'],
  ['criterion 4 longer extension', 'ABC', 'ABCDX', 'partial'],
  ['criterion 4 short source extension', 'AB', 'ABCD', 'partial'],
  ['criterion 4 empty source', '', 'A', 'none'],
  ['criterion 4 exact source', 'ABC', 'ABC', 'perfect'],

  // Criterion 5's documented initial-two-character example.
  ['criterion 5 third-character substitution', 'AB6ZZ', 'ABX', 'partial'],

  // Documented edge cases.
  [
    'edge documented miss is accepted as an extended prefix',
    'ABCDE',
    'ABCDEFX',
    'partial',
  ],
  ['edge one-character extension', 'ABCDE', 'ABCDEF', 'partial'],
  ['edge shorter source extension', 'ABCD', 'ABCDE', 'partial'],
  ['edge shifted source with two substitutions', 'ABCCDE', 'ABXDE', 'none'],
  ['edge equal-length two substitutions', 'ABCD', 'ABXY', 'none'],
  ['edge shorter prefix', 'ABCDE', 'ABC', 'partial'],
  ['edge four-character prefix', 'ABCDE', 'ABCD', 'partial'],
  ['edge empty exact match', '', '', 'perfect'],
  ['edge empty source with query', '', 'AB', 'none'],
  ['edge one-character exact match', 'A', 'A', 'perfect'],
  ['edge one-character source extension', 'A', 'AB', 'partial'],
  ['edge one-character mismatch', 'A', 'B', 'none'],
];

describe('compareStrings v1 callsign matching', () => {
  it.each(compareCases)('%s', (_label, source, query, expected) => {
    expect(compareStrings(source, query)).toBe(expected);
  });

  it('remains case-sensitive and does not strip question marks', () => {
    expect(compareStrings('W6NYC', 'w6nyc')).toBe('none');
    expect(compareStrings('W6NYC', 'W6?')).toBe('partial');
    expect(compareStrings('W6NYC', 'NYC')).toBe('partial');
  });
});

describe('weightedRandom pileup size', () => {
  it('uses strict cumulative boundaries for three available slots', () => {
    const random = vi.spyOn(Math, 'random');
    const total = 1 + 1 / 2 + 1 / 3;
    const weights = [1, 1 / 2, 1 / 3].map((weight) => weight / total);
    const firstBoundary = weights[0];
    const secondBoundary = weights[0] + weights[1];

    random.mockReturnValue(0);
    expect(weightedRandom(3)).toBe(1);

    random.mockReturnValue(firstBoundary - Number.EPSILON);
    expect(weightedRandom(3)).toBe(1);

    random.mockReturnValue(firstBoundary);
    expect(weightedRandom(3)).toBe(2);

    random.mockReturnValue(secondBoundary - Number.EPSILON);
    expect(weightedRandom(3)).toBe(2);

    random.mockReturnValue(secondBoundary);
    expect(weightedRandom(3)).toBe(3);

    random.mockReturnValue(1);
    expect(weightedRandom(3)).toBe(3);
  });

  it('preserves the zero-station fallback', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(weightedRandom(0)).toBe(0);
  });
});

describe('addStations', () => {
  const stationA = { callsign: 'K1AAA', volume: 0.3 };
  const stationB = { callsign: 'W2BBB', volume: 0.4 };
  const stationC = { callsign: 'N3CCC', volume: 0.5 };

  it('adds one station at the bottom random boundary', () => {
    const stations = [];
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(Math, 'random').mockReturnValue(0);
    dependencies.getCallingStation.mockReturnValue(stationA);

    const result = addStations(stations, { maxStations: 4 });

    expect(result).toBe(stations);
    expect(result).toEqual([stationA]);
    expect(dependencies.getCallingStation).toHaveBeenCalledTimes(1);
    expect(document.getElementById('activeStations')).toHaveTextContent('1');
    expect(log).toHaveBeenCalledWith('+ Adding 1 stations...');
  });

  it('sizes additions from remaining capacity at an exact weight boundary', () => {
    const existing = { callsign: 'K0OLD', volume: 0.2 };
    const stations = [existing];
    const total = 1 + 1 / 2 + 1 / 3;
    const firstBoundary = 1 / total;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(Math, 'random').mockReturnValue(firstBoundary);
    dependencies.getCallingStation
      .mockReturnValueOnce(stationA)
      .mockReturnValueOnce(stationB);

    const result = addStations(stations, { maxStations: 4 });

    expect(result).toBe(stations);
    expect(result).toEqual([existing, stationA, stationB]);
    expect(dependencies.getCallingStation).toHaveBeenCalledTimes(2);
    expect(document.getElementById('activeStations')).toHaveTextContent('3');
  });

  it('fills all remaining slots through the random fallback boundary', () => {
    const existing = { callsign: 'K0OLD', volume: 0.2 };
    const stations = [existing];
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(Math, 'random').mockReturnValue(1);
    dependencies.getCallingStation
      .mockReturnValueOnce(stationA)
      .mockReturnValueOnce(stationB)
      .mockReturnValueOnce(stationC);

    const result = addStations(stations, { maxStations: 4 });

    expect(result).toEqual([existing, stationA, stationB, stationC]);
    expect(dependencies.getCallingStation).toHaveBeenCalledTimes(3);
    expect(document.getElementById('activeStations')).toHaveTextContent('4');
  });

  it('does not generate beyond the cap but still refreshes the DOM count', () => {
    const stations = [stationA, stationB];
    const random = vi.spyOn(Math, 'random');

    const result = addStations(stations, { maxStations: 2 });

    expect(result).toBe(stations);
    expect(dependencies.getCallingStation).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
    expect(document.getElementById('activeStations')).toHaveTextContent('2');
  });
});
