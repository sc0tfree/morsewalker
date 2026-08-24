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

  it('normalizes text and reads valid numeric values', () => {
    element('yourCallsign').value = '  k1abc/p  ';
    element('yourName').value = '  Ada Lovelace  ';
    element('yourState').value = ' ca ';
    element('yourSpeed').value = '27';
    element('yourSidetone').value = '725';
    element('yourVolume').value = '38';
    element('maxStations').value = '6';
    element('minSpeed').value = '15';
    element('maxSpeed').value = '32';
    element('minTone').value = '410';
    element('maxTone').value = '890';
    element('minVolume').value = '12';
    element('maxVolume').value = '82';
    element('minWait').value = '0.5';
    element('maxWait').value = '2.25';
    element('usOnly').checked = false;
    chooseRadio('qrn', 'heavy');
    element('qsb').checked = true;
    element('qsbPercentage').value = '73';
    element('enableFarnsworth').checked = true;
    element('farnsworthSpeed').disabled = false;
    element('farnsworthSpeed').value = '11';

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
      yourVolume: 0.38,
      maxStations: 6,
      minSpeed: 15,
      maxSpeed: 32,
      minTone: 410,
      maxTone: 890,
      minVolume: 0.12,
      maxVolume: 0.82,
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

  it('uses browser number parsing for exponent notation', () => {
    setCallsign();
    element('yourSidetone').value = '1e3';
    element('maxStations').value = '1e2';

    expect(element('yourSidetone').validity.valid).toBe(true);
    expect(element('maxStations').validity.valid).toBe(true);
    expect(getInputs()).toMatchObject({
      yourSidetone: 1000,
      maxStations: 100,
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
      minValue: '90',
      maxValue: '10',
      message: 'Minimum Speed cannot be greater than Maximum Speed!',
    },
    {
      minId: 'minTone',
      maxId: 'maxTone',
      minValue: '950',
      maxValue: '300',
      message: 'Minimum Tone cannot be greater than Maximum Tone!',
    },
    {
      minId: 'minVolume',
      maxId: 'maxVolume',
      minValue: '90',
      maxValue: '10',
      message: 'Minimum Volume cannot be greater than Maximum Volume!',
    },
    {
      minId: 'minWait',
      maxId: 'maxWait',
      minValue: '2',
      maxValue: '1',
      message: 'Minimum Wait cannot be greater than Maximum Wait!',
    },
  ])(
    'rejects reversed $minId and $maxId values',
    ({ minId, maxId, minValue, maxValue, message }) => {
      setCallsign();
      element(minId).value = minValue;
      element(maxId).value = maxValue;

      expect(getInputs()).toBeNull();
      expect(element(minId)).toHaveClass('is-invalid');
      expect(element(minId).nextElementSibling).toHaveTextContent(message);
      expect(bootstrapMock.show).toHaveBeenCalledWith(
        element('collapseRespondingStationSettings')
      );
    }
  );

  it.each([
    {
      id: 'yourSpeed',
      value: '0',
      validityFlag: 'rangeUnderflow',
      sectionId: 'collapseYourStationSettings',
    },
    {
      id: 'yourSidetone',
      value: '10000',
      validityFlag: 'rangeOverflow',
      sectionId: 'collapseYourStationSettings',
    },
    {
      id: 'yourVolume',
      value: '37.5',
      validityFlag: 'stepMismatch',
      sectionId: 'collapseYourStationSettings',
    },
    {
      id: 'maxStations',
      value: '',
      validityFlag: 'valueMissing',
      sectionId: 'collapseRespondingStationSettings',
    },
    {
      id: 'minSpeed',
      value: '-5',
      validityFlag: 'rangeUnderflow',
      sectionId: 'collapseRespondingStationSettings',
    },
    {
      id: 'maxSpeed',
      value: '101',
      validityFlag: 'rangeOverflow',
      sectionId: 'collapseRespondingStationSettings',
    },
    {
      id: 'minTone',
      value: '410.5',
      validityFlag: 'stepMismatch',
      sectionId: 'collapseRespondingStationSettings',
    },
    {
      id: 'maxTone',
      value: '10000',
      validityFlag: 'rangeOverflow',
      sectionId: 'collapseRespondingStationSettings',
    },
    {
      id: 'minVolume',
      value: '-1',
      validityFlag: 'rangeUnderflow',
      sectionId: 'collapseRespondingStationSettings',
    },
    {
      id: 'maxVolume',
      value: '82.5',
      validityFlag: 'stepMismatch',
      sectionId: 'collapseRespondingStationSettings',
    },
    {
      id: 'minWait',
      value: '2.25',
      validityFlag: 'rangeOverflow',
      sectionId: 'collapseRespondingStationSettings',
    },
    {
      id: 'maxWait',
      value: '1.1',
      validityFlag: 'stepMismatch',
      sectionId: 'collapseRespondingStationSettings',
    },
  ])(
    'rejects $validityFlag violations for $id',
    ({ id, value, validityFlag, sectionId }) => {
      setCallsign();
      const input = element(id);
      input.value = value;
      element(sectionId).classList.remove('show');
      const validationMessage = input.validationMessage;

      expect(input.validity[validityFlag]).toBe(true);
      expect(validationMessage).not.toBe('');
      expect(getInputs()).toBeNull();
      expect(input).toHaveClass('is-invalid');
      expect(input.nextElementSibling).toHaveTextContent(validationMessage);
      expect(bootstrapMock.show).toHaveBeenCalledWith(element(sectionId));
    }
  );

  it('validates Farnsworth speed only while the control is enabled', () => {
    setCallsign();
    const enableFarnsworth = element('enableFarnsworth');
    const farnsworthSpeed = element('farnsworthSpeed');
    farnsworthSpeed.value = '0';

    expect(farnsworthSpeed.willValidate).toBe(false);
    expect(getInputs()).toMatchObject({
      enableFarnsworth: false,
      farnsworthSpeed: 0,
    });

    enableFarnsworth.checked = true;
    farnsworthSpeed.disabled = false;
    element('collapseRespondingStationSettings').classList.remove('show');
    const validationMessage = farnsworthSpeed.validationMessage;

    expect(farnsworthSpeed.willValidate).toBe(true);
    expect(farnsworthSpeed.validity.rangeUnderflow).toBe(true);
    expect(getInputs()).toBeNull();
    expect(farnsworthSpeed).toHaveClass('is-invalid');
    expect(farnsworthSpeed.nextElementSibling).toHaveTextContent(
      validationMessage
    );
    expect(bootstrapMock.show).toHaveBeenCalledWith(
      element('collapseRespondingStationSettings')
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
