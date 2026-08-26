import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSequenceRandom } from '../../helpers/random.js';
import {
  ARRL_SECTIONS,
  ARRL_SECTIONS_BY_LOCATION,
  RAC_SECTIONS,
  generateFieldDayData,
  isValidFieldDayClass,
  isValidFieldDaySection,
} from '../../../src/js/stations/fieldDayData.js';
import { stateAbbreviations } from '../../../src/js/stations/operatorData.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function installRandomSequence(values, fallback = 0) {
  const sequence = createSequenceRandom(values, fallback);
  vi.spyOn(Math, 'random').mockImplementation(() => sequence.next());
  return sequence;
}

describe('Field Day reference data', () => {
  it('contains the current unique ARRL and RAC section abbreviations', () => {
    expect(ARRL_SECTIONS).toHaveLength(71);
    expect(new Set(ARRL_SECTIONS).size).toBe(71);
    expect(ARRL_SECTIONS).toContain('NLI');
    expect(ARRL_SECTIONS).not.toContain('NLJ');
    expect(ARRL_SECTIONS_BY_LOCATION).toMatchObject({
      HI: ['PAC'],
      NJ: ['NNJ', 'SNJ'],
      NY: ['ENY', 'NLI', 'NNY', 'WNY'],
      PR: ['PR'],
      VI: ['VI'],
      WI: ['WI'],
    });
    expect(new Set(Object.values(ARRL_SECTIONS_BY_LOCATION).flat())).toEqual(
      new Set(ARRL_SECTIONS)
    );
    expect(
      stateAbbreviations.every(
        (state) => ARRL_SECTIONS_BY_LOCATION[state] !== undefined
      )
    ).toBe(true);

    expect(RAC_SECTIONS).toHaveLength(14);
    expect(new Set(RAC_SECTIONS).size).toBe(14);
    expect(RAC_SECTIONS).toEqual(expect.arrayContaining(['GH', 'ONE', 'TER']));
  });

  it.each(['1A', '1d', ' 23A ', '999F'])(
    'accepts the on-air class %j',
    (value) => {
      expect(isValidFieldDayClass(value)).toBe(true);
    }
  );

  it.each(['', '0A', 'A1', '1G', '1AB', '1AC', '1 A'])(
    'rejects the non-exchange class %j',
    (value) => {
      expect(isValidFieldDayClass(value)).toBe(false);
    }
  );

  it.each(['CT', 'ewa', ' NLI ', 'GH', 'ONE', 'TER', 'DX'])(
    'accepts the current section %j',
    (value) => {
      expect(isValidFieldDaySection(value)).toBe(true);
    }
  );

  it.each(['', 'CA', 'TX', 'GTA', 'NT', 'NLJ', 'ZZZ'])(
    'rejects the non-section %j',
    (value) => {
      expect(isValidFieldDaySection(value)).toBe(false);
    }
  );
});

describe('Field Day station data generation', () => {
  it('generates the first weighted class and matching US section with two draws', () => {
    const sequence = installRandomSequence([0, 0]);

    expect(
      generateFieldDayData({
        callsign: 'K1ABC',
        isUS: true,
        state: 'CT',
      })
    ).toEqual({
      fieldDayClass: '1D',
      fieldDaySection: 'CT',
    });
    expect(sequence.calls).toBe(2);
  });

  it('keeps inclusive class boundaries in the earlier weighted bucket', () => {
    const random = vi.spyOn(Math, 'random');

    const boundary = createSequenceRandom([27 / 100, 0], 0);
    random.mockImplementation(() => boundary.next());
    expect(
      generateFieldDayData({ callsign: 'K1ABC', isUS: true }).fieldDayClass
    ).toBe('1D');

    const afterBoundary = createSequenceRandom(
      [27 / 100 + Number.EPSILON, 0],
      0
    );
    random.mockImplementation(() => afterBoundary.next());
    expect(
      generateFieldDayData({ callsign: 'K1ABC', isUS: true }).fieldDayClass
    ).toBe('3A');
  });

  it('retains a rare high class with a matching single-section state', () => {
    installRandomSequence([0.975, 1 - Number.EPSILON]);

    expect(
      generateFieldDayData({
        callsign: 'W1AW',
        isUS: true,
        state: 'WI',
      })
    ).toEqual({
      fieldDayClass: '23A',
      fieldDaySection: 'WI',
    });
  });

  it.each([
    ['NJ', 0, 'NNJ'],
    ['NJ', 1 - Number.EPSILON, 'SNJ'],
    ['NY', 0, 'ENY'],
    ['NY', 1 - Number.EPSILON, 'WNY'],
    ['CA', 0, 'EB'],
    ['CA', 1 - Number.EPSILON, 'SV'],
    ['HI', 0.5, 'PAC'],
  ])('maps %s section draw %s to %s', (state, sectionDraw, fieldDaySection) => {
    installRandomSequence([0, sectionDraw]);

    expect(
      generateFieldDayData({ callsign: 'K1ABC', isUS: true, state })
    ).toEqual({
      fieldDayClass: '1D',
      fieldDaySection,
    });
  });

  it('falls back to the complete US section list for an unknown state', () => {
    installRandomSequence([0, 0]);

    expect(
      generateFieldDayData({
        callsign: 'K1ABC',
        isUS: true,
        state: 'ZZ',
      })
    ).toEqual({
      fieldDayClass: '1D',
      fieldDaySection: 'AL',
    });
  });

  it.each(['VA3ABC', 'VE3ABC', 'VO1ABC', 'VY1ABC'])(
    'uses a RAC section for Canadian call %s',
    (callsign) => {
      installRandomSequence([0, 0]);

      expect(generateFieldDayData({ callsign, isUS: false })).toEqual({
        fieldDayClass: '1D',
        fieldDaySection: 'AB',
      });
    }
  );

  it('uses DX for other international calls and still consumes two draws', () => {
    const sequence = installRandomSequence([0, 0.75]);

    expect(generateFieldDayData({ callsign: 'F1ABC', isUS: false })).toEqual({
      fieldDayClass: '1D',
      fieldDaySection: 'DX',
    });
    expect(sequence.calls).toBe(2);
  });
});
