import { describe, expect, it } from 'vitest';

import { applyCutNumbers } from '../../../src/js/session/message-format.js';

describe('exchange message formatting', () => {
  it('leaves messages unchanged when cut numbers are disabled', () => {
    expect(
      applyCutNumbers('5NN 009 TU', {
        enableCutNumbers: false,
        cutNumbers: { 0: 'T', 9: 'N' },
      })
    ).toBe('5NN 009 TU');
  });

  it('replaces each selected digit while preserving unselected digits', () => {
    expect(
      applyCutNumbers('5NN 1029 TU', {
        enableCutNumbers: true,
        cutNumbers: { 0: 'T', 9: 'N' },
      })
    ).toBe('5NN 1T2N TU');
  });

  it('supports mixed cut-number maps', () => {
    expect(
      applyCutNumbers('0123456789', {
        enableCutNumbers: true,
        cutNumbers: { 0: 'T', 1: 'A', 5: 'E', 9: 'N' },
      })
    ).toBe('TA234E678N');
  });

  it('does not alter nonnumeric exchange text', () => {
    expect(
      applyCutNumbers('TU ALICE TX', {
        enableCutNumbers: true,
        cutNumbers: { 0: 'T', 9: 'N' },
      })
    ).toBe('TU ALICE TX');
  });

  it('uses unchanged output when formatting settings are omitted', () => {
    expect(applyCutNumbers('5NN 123 TU')).toBe('5NN 123 TU');
  });
});
