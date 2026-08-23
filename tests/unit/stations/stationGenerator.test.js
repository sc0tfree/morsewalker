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

import { createSequenceRandom } from '../../helpers/random.js';

let getCallingStation;
let getYourStation;

const formats = ['1x1', '1x2', '1x3', '2x1', '2x2', '2x3'];
const oneLetterInternationalPrefix = 8.25 / 38;

async function loadAppHtml() {
  const html = await readFile(resolve(process.cwd(), 'src/index.html'), 'utf8');
  document.open();
  document.write(html);
  document.close();
}

beforeAll(async () => {
  await loadAppHtml();
  ({ getCallingStation, getYourStation } = await import(
    '../../../src/js/stationGenerator.js'
  ));
});

beforeEach(async () => {
  await loadAppHtml();
  setValue('yourCallsign', 'W6NYC');
});

afterEach(() => {
  vi.restoreAllMocks();
});

function setValue(id, value) {
  document.getElementById(id).value = String(value);
}

function setChecked(id, checked) {
  document.getElementById(id).checked = checked;
}

function selectOnlyFormat(selectedFormat) {
  for (const format of formats) {
    setChecked(format, format === selectedFormat);
  }
}

function installRandomSequence(values, fallback = 0) {
  const sequence = createSequenceRandom(values, fallback);
  vi.spyOn(Math, 'random').mockImplementation(() => sequence.next());
  return sequence;
}

const formatCases = [
  ['1x1', 'K0A', 'F0A', 13],
  ['1x2', 'K0AA', 'F0AA', 14],
  ['1x3', 'K0AAA', 'F0AAA', 15],
  ['2x1', 'KA0A', 'FA0A', 14],
  ['2x2', 'KA0AA', 'FA0AA', 15],
  ['2x3', 'KA0AAA', 'FA0AAA', 16],
];

describe('getYourStation', () => {
  it('maps normalized DOM inputs to the exact v1 station shape', () => {
    setValue('yourCallsign', ' w6nyc ');
    setValue('yourName', ' Henry ');
    setValue('yourState', ' ca ');
    setValue('yourSpeed', 23);
    setValue('yourSidetone', 725);
    setValue('yourVolume', 65);

    expect(getYourStation()).toEqual({
      callsign: 'W6NYC',
      wpm: 23,
      volume: 0.65,
      frequency: 725,
      name: 'Henry',
      state: 'CA',
      player: null,
      qsb: false,
    });
  });

  it('returns undefined when the shared input validation fails', () => {
    setValue('yourCallsign', '   ');

    expect(getYourStation()).toBeUndefined();
    expect(document.getElementById('yourCallsign')).toHaveClass('is-invalid');
  });
});

describe('callsign generation', () => {
  it.each(formatCases)(
    'generates the %s US format and preserves draw count',
    (format, expectedUS, _expectedInternational, expectedDraws) => {
      selectOnlyFormat(format);
      setChecked('usOnly', true);
      const sequence = installRandomSequence([], 0);

      const station = getCallingStation();

      expect(station.callsign).toBe(expectedUS);
      expect(station.state).toBe('AL');
      expect(sequence.calls).toBe(expectedDraws);
    }
  );

  it.each(formatCases)(
    'generates the %s international format and preserves draw count',
    (format, _expectedUS, expectedInternational, expectedDraws) => {
      selectOnlyFormat(format);
      setChecked('usOnly', false);
      const sequence = installRandomSequence(
        [0.4, oneLetterInternationalPrefix],
        0
      );

      const station = getCallingStation();

      expect(station.callsign).toBe(expectedInternational);
      expect(station.state).toBe('');
      expect(sequence.calls).toBe(expectedDraws);
    }
  );

  it('uses US below 0.4 and international at the exact 0.4 boundary', () => {
    selectOnlyFormat('1x1');
    setChecked('usOnly', false);
    const random = vi.spyOn(Math, 'random');

    const belowBoundary = createSequenceRandom([0.4 - Number.EPSILON], 0);
    random.mockImplementation(() => belowBoundary.next());
    const usStation = getCallingStation();

    const atBoundary = createSequenceRandom(
      [0.4, oneLetterInternationalPrefix],
      0
    );
    random.mockImplementation(() => atBoundary.next());
    const internationalStation = getCallingStation();

    expect(usStation).toMatchObject({ callsign: 'K0A', state: 'AL' });
    expect(internationalStation).toMatchObject({
      callsign: 'F0A',
      state: '',
    });
  });

  it('retries a two-letter international prefix for a 1x format', () => {
    selectOnlyFormat('1x1');
    setChecked('usOnly', false);
    const sequence = installRandomSequence(
      [0.4, 0, 0, oneLetterInternationalPrefix, 0],
      0
    );

    const station = getCallingStation();

    expect(station.callsign).toBe('F0A');
    expect(sequence.calls).toBe(15);
  });

  it('keeps a two-letter international prefix for a 2x format', () => {
    selectOnlyFormat('2x1');
    setChecked('usOnly', false);
    installRandomSequence([0.4], 0);

    expect(getCallingStation().callsign).toBe('9A0A');
  });

  it('keeps inclusive weighted prefix boundaries in the earlier US bucket', () => {
    selectOnlyFormat('1x1');
    setChecked('usOnly', true);
    const random = vi.spyOn(Math, 'random');

    const generateAtPrefixDraw = (prefixDraw) => {
      const sequence = createSequenceRandom([0, 0, prefixDraw], 0);
      random.mockImplementation(() => sequence.next());
      return getCallingStation().callsign;
    };

    expect(generateAtPrefixDraw(40 / 85)).toBe('K0A');
    expect(generateAtPrefixDraw(40 / 85 + Number.EPSILON)).toBe('W0A');
    expect(generateAtPrefixDraw(65 / 85)).toBe('W0A');
    expect(generateAtPrefixDraw(65 / 85 + Number.EPSILON)).toBe('N0A');
  });
});

describe('calling-station attributes', () => {
  it('preserves every minimum-boundary attribute and skips a QSB decision draw', () => {
    selectOnlyFormat('1x1');
    setChecked('usOnly', true);
    const sequence = installRandomSequence([], 0);

    const station = getCallingStation();

    expect(station).toEqual({
      callsign: 'K0A',
      wpm: 18,
      enableFarnsworth: false,
      farnsworthSpeed: 10,
      volume: 0.3,
      frequency: 400,
      name: 'Adam',
      state: 'AL',
      serialNumber: '01',
      cwopsNumber: 1,
      player: null,
      qsb: false,
      qsbFrequency: 0.05,
      qsbDepth: 0.6,
    });
    expect(sequence.calls).toBe(13);
  });

  it('preserves upper-boundary ranges and their inclusive/exclusive behavior', () => {
    const almostOne = 1 - Number.EPSILON;
    selectOnlyFormat('2x3');
    setChecked('usOnly', true);
    installRandomSequence([], almostOne);

    const station = getCallingStation();

    expect(station).toMatchObject({
      callsign: 'AL9ZZZ',
      wpm: 25,
      enableFarnsworth: false,
      farnsworthSpeed: 10,
      frequency: 899,
      name: 'Yan',
      state: 'WY',
      serialNumber: '30',
      cwopsNumber: 4000,
      player: null,
      qsb: false,
    });
    expect(station.volume).toBeLessThan(1);
    expect(station.volume).toBeCloseTo(1, 12);
    expect(station.qsbFrequency).toBeLessThan(0.5);
    expect(station.qsbFrequency).toBeCloseTo(0.5, 12);
    expect(station.qsbDepth).toBeLessThan(1);
    expect(station.qsbDepth).toBeCloseTo(1, 12);
  });

  it('copies enabled Farnsworth settings into generated stations', () => {
    selectOnlyFormat('1x1');
    setChecked('enableFarnsworth', true);
    setValue('farnsworthSpeed', 12);
    installRandomSequence([], 0);

    expect(getCallingStation()).toMatchObject({
      enableFarnsworth: true,
      farnsworthSpeed: 12,
    });
  });

  it.each([
    [0, 0, false],
    [50, 0.5 - Number.EPSILON, true],
    [50, 0.5, false],
    [100, 1 - Number.EPSILON, true],
    [100, 1, false],
  ])(
    'assigns QSB at %i%% with random %s as %s',
    (percentage, qsbDraw, expected) => {
      selectOnlyFormat('1x1');
      setChecked('qsb', true);
      setValue('qsbPercentage', percentage);
      const values = [...Array(11).fill(0), qsbDraw, 0, 0];
      const sequence = installRandomSequence(values, 0);

      const station = getCallingStation();

      expect(station.qsb).toBe(expected);
      expect(station.qsbFrequency).toBe(0.05);
      expect(station.qsbDepth).toBe(0.6);
      expect(sequence.calls).toBe(14);
    }
  );

  it('still generates QSB frequency and depth while QSB is disabled', () => {
    const almostOne = 1 - Number.EPSILON;
    selectOnlyFormat('1x1');
    setChecked('qsb', false);
    const values = [...Array(11).fill(0), almostOne, almostOne];
    installRandomSequence(values, 0);

    const station = getCallingStation();

    expect(station.qsb).toBe(false);
    expect(station.qsbFrequency).toBeLessThan(0.5);
    expect(station.qsbFrequency).toBeCloseTo(0.5, 12);
    expect(station.qsbDepth).toBeLessThan(1);
    expect(station.qsbDepth).toBeCloseTo(1, 12);
  });
});
