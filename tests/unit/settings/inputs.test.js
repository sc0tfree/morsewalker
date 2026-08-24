// @vitest-environment jsdom

import { URL as NodeUrl, pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const bootstrapMock = vi.hoisted(() => ({
  construct: vi.fn(),
  getInstance: vi.fn(),
  show: vi.fn(),
}));

vi.mock('bootstrap', () => {
  class Collapse {
    static getInstance(section) {
      return bootstrapMock.getInstance(section);
    }

    constructor(section, options) {
      this.section = section;
      bootstrapMock.construct(section, options);
    }

    show() {
      bootstrapMock.show(this.section);
      this.section.classList.add('show');
    }
  }

  return { Collapse };
});

let clearAllInvalidStates;
let getInputs;

function element(id) {
  return document.getElementById(id);
}

function chooseRadio(name, value) {
  document.querySelector(`input[name="${name}"][value="${value}"]`).checked =
    true;
}

function setCallsign(value = 'W6NYC') {
  element('yourCallsign').value = value;
}

async function loadActualAppHtml() {
  const RuntimeUrl = globalThis.URL;

  class FileAwareUrl extends NodeUrl {
    constructor(input, base) {
      if (String(input).endsWith('/src/index.html')) {
        return pathToFileURL(`${process.cwd()}/src/index.html`);
      }

      super(input, base);
    }
  }

  vi.stubGlobal('URL', FileAwareUrl);
  try {
    const { loadAppHtml } = await import('../../helpers/dom.js');
    await loadAppHtml();
  } finally {
    vi.stubGlobal('URL', RuntimeUrl);
  }
}

beforeEach(async () => {
  vi.resetModules();
  await loadActualAppHtml();
  bootstrapMock.getInstance.mockReturnValue(null);
  ({ clearAllInvalidStates, getInputs } = await import(
    '../../../src/js/inputs.js'
  ));
});

describe('settings form parsing and normalization', () => {
  it('uses wait defaults that preserve the existing response timing', () => {
    expect(element('minWait')).toHaveValue(0.25);
    expect(element('maxWait')).toHaveValue(2);
  });

  it('normalizes text and numeric values while preserving current field semantics', () => {
    element('yourCallsign').value = '  k1abc/p  ';
    element('yourName').value = '  Ada Lovelace  ';
    element('yourState').value = ' ca ';
    element('yourSpeed').value = '27.9';
    element('yourSidetone').value = '725';
    element('yourVolume').value = '37.5';
    element('maxStations').value = '6.8';
    element('minSpeed').value = '15.9';
    element('maxSpeed').value = '32.2';
    element('minTone').value = '410.5';
    element('maxTone').value = '890.9';
    element('minVolume').value = '12.5';
    element('maxVolume').value = '82.5';
    element('minWait').value = '0.5';
    element('maxWait').value = '2.25';
    element('usOnly').checked = false;
    chooseRadio('qrn', 'heavy');
    element('qsb').checked = true;
    element('qsbPercentage').value = '73';
    element('enableFarnsworth').checked = true;
    element('farnsworthSpeed').value = '11.9';

    for (const id of ['1x1', '1x2', '1x3', '2x1', '2x2', '2x3']) {
      element(id).checked = false;
    }
    element('1x1').checked = true;
    element('2x3').checked = true;

    element('enableCutNumbers').checked = true;
    for (const id of [
      'cutT',
      'cutA',
      'cutU',
      'cutV',
      'cutE',
      'cutG',
      'cutD',
      'cutN',
    ]) {
      element(id).checked = false;
    }
    element('cutA').checked = true;
    element('cutG').checked = true;

    expect(getInputs()).toEqual({
      mode: 'single',
      yourCallsign: 'K1ABC/P',
      yourName: 'Ada Lovelace',
      yourState: 'CA',
      yourSpeed: 27,
      yourSidetone: 725,
      yourVolume: 0.375,
      maxStations: 6,
      minSpeed: 15,
      maxSpeed: 32,
      minTone: 410,
      maxTone: 890,
      minVolume: 0.125,
      maxVolume: 0.825,
      minWait: 0.5,
      maxWait: 2.25,
      usOnly: false,
      qrn: 'heavy',
      qsb: true,
      qsbPercentage: 73,
      enableFarnsworth: true,
      farnsworthSpeed: 11,
      formats: ['1x1', '2x3'],
      enableCutNumbers: true,
      cutNumbers: { 1: 'A', 7: 'G' },
    });
  });

  it.each(['single', 'contest', 'pota'])(
    'allows blank name and state in %s mode',
    (mode) => {
      setCallsign();
      chooseRadio('mode', mode);

      expect(getInputs()).toMatchObject({
        mode,
        yourName: '',
        yourState: '',
      });
    }
  );

  it('requires a name, but not a state, in CWT mode', () => {
    setCallsign();
    chooseRadio('mode', 'cwt');

    expect(getInputs()).toBeNull();
    expect(element('yourName')).toHaveClass('is-invalid');
    expect(element('yourName').nextElementSibling).toHaveTextContent(
      'Your name is required for CWT mode.'
    );
    expect(element('yourState')).not.toHaveClass('is-invalid');

    element('yourName').value = 'Ada';

    expect(getInputs()).toMatchObject({
      mode: 'cwt',
      yourName: 'Ada',
      yourState: '',
    });
  });

  it('requires both name and state in SST mode', () => {
    setCallsign();
    chooseRadio('mode', 'sst');

    expect(getInputs()).toBeNull();
    expect(element('yourName')).toHaveClass('is-invalid');
    expect(element('yourState')).toHaveClass('is-invalid');

    element('yourName').value = 'Ada';
    expect(getInputs()).toBeNull();
    expect(element('yourName')).not.toHaveClass('is-invalid');
    expect(element('yourState')).toHaveClass('is-invalid');

    element('yourState').value = 'ny';
    expect(getInputs()).toMatchObject({
      mode: 'sst',
      yourName: 'Ada',
      yourState: 'NY',
    });
  });

  it('returns selected callsign formats in the source-defined order', () => {
    setCallsign();
    for (const id of ['1x1', '1x2', '1x3', '2x1', '2x2', '2x3']) {
      element(id).checked = false;
    }

    element('2x1').checked = true;
    element('1x3').checked = true;
    element('1x1').checked = true;

    expect(getInputs().formats).toEqual(['1x1', '1x3', '2x1']);
  });

  it('maps every selected cut number even when cut numbers are disabled', () => {
    setCallsign();
    element('enableCutNumbers').checked = false;
    for (const id of [
      'cutT',
      'cutA',
      'cutU',
      'cutV',
      'cutE',
      'cutG',
      'cutD',
      'cutN',
    ]) {
      element(id).checked = true;
    }

    expect(getInputs()).toMatchObject({
      enableCutNumbers: false,
      cutNumbers: {
        0: 'T',
        1: 'A',
        2: 'U',
        3: 'V',
        5: 'E',
        7: 'G',
        8: 'D',
        9: 'N',
      },
    });
  });
});

describe('settings validation and invalid-state behavior', () => {
  it.each([
    {
      minId: 'minSpeed',
      maxId: 'maxSpeed',
      low: '10',
      high: '50',
      message: 'Must be ≤ Max Speed',
    },
    {
      minId: 'minVolume',
      maxId: 'maxVolume',
      low: '10',
      high: '90',
      message: 'Must be ≤ Max Volume',
    },
    {
      minId: 'minTone',
      maxId: 'maxTone',
      low: '300',
      high: '1200',
      message: 'Must be ≤ Max Tone',
    },
    {
      minId: 'minWait',
      maxId: 'maxWait',
      low: '0.25',
      high: '1.5',
      message: 'Must be ≤ Max Wait',
    },
  ])(
    'rejects reversed $minId and $maxId values',
    ({ minId, maxId, low, high, message }) => {
      setCallsign();
      element(minId).value = high;
      element(maxId).value = low;

      expect(getInputs()).toBeNull();
      expect(element(minId)).toHaveClass('is-invalid');
      expect(element(minId).nextElementSibling).toHaveTextContent(message);
      expect(bootstrapMock.show).toHaveBeenCalledWith(
        element('collapseRespondingStationSettings')
      );
    }
  );

  it.each([
    { id: 'yourSpeed', value: '0', message: 'Must be ≥ 5' },
    { id: 'yourSidetone', value: '10000', message: 'Must be ≤ 1500' },
    { id: 'yourVolume', value: '120', message: 'Must be ≤ 100' },
    { id: 'maxStations', value: '0', message: 'Must be ≥ 1' },
    { id: 'minSpeed', value: '-5', message: 'Must be ≥ 5' },
    { id: 'maxSpeed', value: '101', message: 'Must be ≤ 60' },
    { id: 'minTone', value: '150', message: 'Must be ≥ 200' },
    { id: 'maxTone', value: '9999', message: 'Must be ≤ 1500' },
    { id: 'minVolume', value: '-10', message: 'Must be ≥ 0' },
    { id: 'maxVolume', value: '120', message: 'Must be ≤ 100' },
    { id: 'minWait', value: '-1', message: 'Must be ≥ 0' },
    { id: 'maxWait', value: '6', message: 'Must be ≤ 5' },
    { id: 'yourSpeed', value: '', message: 'Required' },
  ])('rejects $id of "$value" with "$message"', ({ id, value, message }) => {
    setCallsign();
    element(id).value = value;

    expect(getInputs()).toBeNull();
    expect(element(id)).toHaveClass('is-invalid');
    expect(element(id).nextElementSibling).toHaveTextContent(message);
  });

  it('ignores the bounds of a disabled Farnsworth speed', () => {
    setCallsign();
    element('farnsworthSpeed').value = '0';

    expect(getInputs()).not.toBeNull();

    element('farnsworthSpeed').disabled = false;

    expect(getInputs()).toBeNull();
    expect(element('farnsworthSpeed').nextElementSibling).toHaveTextContent(
      'Must be ≥ 5'
    );
  });

  it('opens invalid sections and clears classes on input without clearing feedback', () => {
    element('collapseYourStationSettings').classList.remove('show');
    element('minSpeed').value = '30';
    element('maxSpeed').value = '20';

    expect(getInputs()).toBeNull();
    expect(element('yourCallsign')).toHaveClass('is-invalid');
    expect(element('minSpeed')).toHaveClass('is-invalid');
    expect(bootstrapMock.show).toHaveBeenCalledWith(
      element('collapseYourStationSettings')
    );
    expect(bootstrapMock.show).toHaveBeenCalledWith(
      element('collapseRespondingStationSettings')
    );

    element('yourCallsign').value = 'k1abc';
    element('yourCallsign').dispatchEvent(
      new Event('input', { bubbles: true })
    );

    expect(element('yourCallsign')).not.toHaveClass('is-invalid');
    expect(element('yourCallsign').nextElementSibling).toHaveTextContent(
      'Your callsign is required.'
    );
    expect(element('minSpeed')).toHaveClass('is-invalid');

    clearAllInvalidStates();

    expect(document.querySelectorAll('.is-invalid')).toHaveLength(0);
  });
});
