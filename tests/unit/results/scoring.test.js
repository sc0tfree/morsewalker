/* @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';

import { compareExtraInfo } from '../../../src/js/results/scoring.js';

const station = {
  cwopsNumber: 2468,
  name: 'ALICE',
  serialNumber: '07',
  state: 'AK',
};

function resultText(html) {
  const element = document.createElement('div');
  element.innerHTML = html;
  return element.textContent.replace(/\s+/g, ' ').trim();
}

describe('mode-specific result scoring', () => {
  it('omits the AGN suffix when no fill was requested', () => {
    expect(resultText(compareExtraInfo('state', 'AK', station))).toBe('AK');
  });

  it('appends a field AGN count to a correct string result', () => {
    expect(resultText(compareExtraInfo('state', 'AK', station, 2))).toBe(
      'AK (2 AGN)'
    );
  });

  it('preserves the expected value before an incorrect field AGN count', () => {
    expect(resultText(compareExtraInfo('state', 'AL', station, 1))).toBe(
      'AL (AK) (1 AGN)'
    );
  });

  it('appends AGN counts to correct and incorrect numeric results', () => {
    expect(
      resultText(compareExtraInfo('serialNumber', '007', station, 2))
    ).toBe('7 (2 AGN)');
    expect(resultText(compareExtraInfo('serialNumber', '8', station, 1))).toBe(
      '8 (07) (1 AGN)'
    );
  });

  it('reports missing numeric copy with its expected value and AGN count', () => {
    expect(resultText(compareExtraInfo('cwopsNumber', '', station, 3))).toBe(
      '(2468) (3 AGN)'
    );
  });

  it('appends AGN counts to unavailable string components', () => {
    expect(resultText(compareExtraInfo('state', '', { state: '' }, 1))).toBe(
      'N/A (1 AGN)'
    );
  });

  it('ignores AGN counts when no field is configured', () => {
    expect(compareExtraInfo(null, '', station, 2)).toBe('');
  });
});
