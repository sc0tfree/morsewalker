/* @vitest-environment jsdom */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPreferenceGroupElements,
  persistSettingsGroup,
  PREFERENCE_GROUPS,
  resetSettingsGroup,
  restoreSettingsGroup,
  wireSettingsStorage,
} from '../../../src/js/settings/storage.js';

const respondingValues = {
  minStations: 2,
  maxStations: 7,
  minSpeed: 12,
  maxSpeed: 36,
  enableFarnsworth: true,
  farnsworthSpeed: 8,
  minTone: 350,
  maxTone: 1050,
  minVolume: 10,
  maxVolume: 90,
  minWait: 0.5,
  maxWait: 3.25,
  usOnly: false,
  '1x1': true,
  '1x2': false,
  '2x1': false,
  '2x2': false,
  '1x3': false,
  '2x3': false,
  enableCutNumbers: true,
  cutT: false,
  cutA: true,
  cutU: true,
  cutV: true,
  cutE: true,
  cutG: true,
  cutD: true,
  cutN: false,
};

const effectsValues = {
  qrn: 'heavy',
  qsb: true,
  qsbPercentage: 82,
};

function createMemoryStorage(initialValues = {}) {
  const values = new Map(
    Object.entries(initialValues).map(([key, value]) => [
      String(key),
      String(value),
    ])
  );

  return {
    getItem: vi.fn((key) => values.get(String(key)) ?? null),
    removeItem: vi.fn((key) => values.delete(String(key))),
    setItem: vi.fn((key, value) => {
      values.set(String(key), String(value));
    }),
    peek(key) {
      return values.get(String(key)) ?? null;
    },
  };
}

function elementsForControl(group, control) {
  const section = document.getElementById(group.sectionId);
  if (control.id) {
    const element = document.getElementById(control.id);
    return element && section.contains(element) ? [element] : [];
  }
  return [...section.querySelectorAll(`input[name="${control.name}"]`)];
}

function readGroupValues(groupId) {
  const group = PREFERENCE_GROUPS[groupId];

  return Object.fromEntries(
    group.controls.map((control) => {
      const elements = elementsForControl(group, control);
      let value;

      if (control.type === 'checkbox') {
        value = elements[0].checked;
      } else if (control.type === 'radio') {
        value = elements.find((element) => element.checked)?.value;
      } else {
        value = Number(elements[0].value);
      }

      return [control.key, value];
    })
  );
}

function applyGroupValues(groupId, values) {
  const group = PREFERENCE_GROUPS[groupId];

  group.controls.forEach((control) => {
    const elements = elementsForControl(group, control);
    const value = values[control.key];

    if (control.type === 'checkbox') {
      elements[0].checked = value;
    } else if (control.type === 'radio') {
      elements.forEach((element) => {
        element.checked = element.value === value;
      });
    } else {
      elements[0].value = String(value);
    }
  });
}

function applyGroupDefaults(groupId) {
  const group = PREFERENCE_GROUPS[groupId];

  group.controls.forEach((control) => {
    const elements = elementsForControl(group, control);
    if (control.type === 'checkbox' || control.type === 'radio') {
      elements.forEach((element) => {
        element.checked = element.defaultChecked;
      });
    } else {
      elements[0].value = elements[0].defaultValue;
    }
  });
}

function storedPayload(storage, groupId) {
  return JSON.parse(storage.peek(PREFERENCE_GROUPS[groupId].storageKey));
}

async function loadAppHtml() {
  const html = await readFile(resolve(process.cwd(), 'src/index.html'), 'utf8');
  document.open();
  document.write(html);
  document.close();
}

beforeEach(async () => {
  await loadAppHtml();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('preference registry contract', () => {
  it.each(Object.entries(PREFERENCE_GROUPS))(
    'covers every control in %s exactly once',
    (groupId, group) => {
      const section = document.getElementById(group.sectionId);
      const formControls = [
        ...section.querySelectorAll('input, select, textarea'),
      ];
      const registeredControls = group.controls.flatMap((control) => {
        const elements = elementsForControl(group, control);
        expect(
          elements.length,
          `${groupId}.${control.key} must resolve inside #${group.sectionId}`
        ).toBeGreaterThan(0);
        return elements;
      });

      expect(new Set(registeredControls).size).toBe(registeredControls.length);
      expect(registeredControls.map(({ id }) => id).sort()).toEqual(
        formControls.map(({ id }) => id).sort()
      );
      expect(getPreferenceGroupElements(groupId)).toEqual(registeredControls);
    }
  );
});

describe('group persistence', () => {
  it('round-trips every Responding Station and Effects preference as typed data', () => {
    const storage = createMemoryStorage();
    applyGroupValues('respondingStation', respondingValues);
    applyGroupValues('effects', effectsValues);

    persistSettingsGroup('respondingStation', storage);
    persistSettingsGroup('effects', storage);

    expect(storedPayload(storage, 'respondingStation')).toEqual({
      values: respondingValues,
      version: 1,
    });
    expect(storedPayload(storage, 'effects')).toEqual({
      values: effectsValues,
      version: 1,
    });

    applyGroupDefaults('respondingStation');
    applyGroupDefaults('effects');
    restoreSettingsGroup('respondingStation', storage);
    restoreSettingsGroup('effects', storage);

    expect(readGroupValues('respondingStation')).toEqual(respondingValues);
    expect(readGroupValues('effects')).toEqual(effectsValues);
  });

  it('restores older preferences with no minimum without resetting other values', () => {
    const legacyValues = { ...respondingValues };
    delete legacyValues.minStations;
    const storage = createMemoryStorage({
      [PREFERENCE_GROUPS.respondingStation.storageKey]: JSON.stringify({
        values: legacyValues,
        version: 1,
      }),
    });
    document.getElementById('minStations').value = '5';

    restoreSettingsGroup('respondingStation', storage);

    expect(readGroupValues('respondingStation')).toEqual({
      ...legacyValues,
      minStations: 0,
    });
    persistSettingsGroup('respondingStation', storage);
    expect(storedPayload(storage, 'respondingStation')).toEqual({
      values: { ...legacyValues, minStations: 0 },
      version: 1,
    });
  });

  it.each([-1, 21, 2.5, '2'])(
    'defaults invalid stored minimum %s while preserving valid preferences',
    (minStations) => {
      const storage = createMemoryStorage({
        [PREFERENCE_GROUPS.respondingStation.storageKey]: JSON.stringify({
          values: { ...respondingValues, minStations },
          version: 1,
        }),
      });

      restoreSettingsGroup('respondingStation', storage);

      expect(readGroupValues('respondingStation')).toEqual({
        ...respondingValues,
        minStations: 0,
      });
    }
  );

  it('repairs a reversed station range without resetting other preferences', () => {
    const storage = createMemoryStorage({
      [PREFERENCE_GROUPS.respondingStation.storageKey]: JSON.stringify({
        values: { ...respondingValues, minStations: 8, maxStations: 7 },
        version: 1,
      }),
    });

    restoreSettingsGroup('respondingStation', storage);

    expect(readGroupValues('respondingStation')).toEqual({
      ...respondingValues,
      minStations: 0,
      maxStations: 3,
    });
  });

  it('normalizes integer-consumed fields while preserving decimal settings', () => {
    const storage = createMemoryStorage();
    document.getElementById('minStations').value = '2.9';
    document.getElementById('maxStations').value = '6.8';
    document.getElementById('minVolume').value = '12.5';
    document.getElementById('minWait').value = '0.6';
    document.getElementById('qsbPercentage').value = '71.9';

    persistSettingsGroup('respondingStation', storage);
    persistSettingsGroup('effects', storage);

    expect(storedPayload(storage, 'respondingStation').values).toMatchObject({
      minStations: 2,
      maxStations: 6,
      minVolume: 12.5,
      minWait: 0.6,
    });
    expect(storedPayload(storage, 'effects').values.qsbPercentage).toBe(71);
  });

  it('persists complete exponent values and truncates only integer preferences', () => {
    const storage = createMemoryStorage();
    applyGroupValues('respondingStation', {
      ...respondingValues,
      minStations: '2.9e0',
      maxStations: '1e1',
      minSpeed: '1.59e1',
      maxSpeed: '6e1',
      farnsworthSpeed: '1.19e1',
      minTone: '4.105e2',
      maxTone: '8.909e2',
      minVolume: '1.25e1',
      maxVolume: '8.25e1',
      minWait: '5e-1',
      maxWait: '2.25e0',
    });
    applyGroupValues('effects', { ...effectsValues, qsbPercentage: '7.39e1' });

    persistSettingsGroup('respondingStation', storage);
    persistSettingsGroup('effects', storage);

    const expectedResponding = {
      ...respondingValues,
      minStations: 2,
      maxStations: 10,
      minSpeed: 15,
      maxSpeed: 60,
      farnsworthSpeed: 11,
      minTone: 410,
      maxTone: 890,
      minVolume: 12.5,
      maxVolume: 82.5,
      minWait: 0.5,
      maxWait: 2.25,
    };
    const expectedEffects = { ...effectsValues, qsbPercentage: 73 };
    expect(storedPayload(storage, 'respondingStation')).toEqual({
      values: expectedResponding,
      version: 1,
    });
    expect(storedPayload(storage, 'effects')).toEqual({
      values: expectedEffects,
      version: 1,
    });

    applyGroupDefaults('respondingStation');
    applyGroupDefaults('effects');
    restoreSettingsGroup('respondingStation', storage);
    restoreSettingsGroup('effects', storage);

    expect(readGroupValues('respondingStation')).toEqual(expectedResponding);
    expect(readGroupValues('effects')).toEqual(expectedEffects);
  });

  it.each(['60.9', '6.09e1', '6.1e1'])(
    'omits out-of-bounds speed %s before integer truncation',
    (value) => {
      const storage = createMemoryStorage();
      document.getElementById('maxSpeed').value = value;

      persistSettingsGroup('respondingStation', storage);

      expect(
        storedPayload(storage, 'respondingStation').values
      ).not.toHaveProperty('maxSpeed');
      restoreSettingsGroup('respondingStation', storage);
      expect(document.getElementById('maxSpeed')).toHaveValue(25);
    }
  );

  it('omits blank numeric preferences, including disabled Farnsworth, instead of saving zero', () => {
    const storage = createMemoryStorage();
    const ids = ['minStations', 'maxStations', 'farnsworthSpeed', 'minWait'];
    ids.forEach((id) => {
      document.getElementById(id).value = '';
    });

    persistSettingsGroup('respondingStation', storage);

    const values = storedPayload(storage, 'respondingStation').values;
    ids.forEach((id) => expect(values).not.toHaveProperty(id));
    restoreSettingsGroup('respondingStation', storage);
    expect(document.getElementById('minStations')).toHaveValue(0);
    expect(document.getElementById('maxStations')).toHaveValue(3);
    expect(document.getElementById('farnsworthSpeed')).toHaveValue(10);
    expect(document.getElementById('minWait')).toHaveValue(0.25);
  });

  it('repairs reversed exponent ranges after restoring their numeric values', () => {
    const storage = createMemoryStorage();
    document.getElementById('minSpeed').value = '1e1';
    document.getElementById('maxSpeed').value = '9';

    persistSettingsGroup('respondingStation', storage);

    expect(storedPayload(storage, 'respondingStation').values).toMatchObject({
      minSpeed: 10,
      maxSpeed: 9,
    });
    restoreSettingsGroup('respondingStation', storage);
    expect(document.getElementById('minSpeed')).toHaveValue(18);
    expect(document.getElementById('maxSpeed')).toHaveValue(25);
  });

  it('keeps the runtime snapshot consistent across legacy and grouped exponent save/reload', async () => {
    const { getInputs } = await import('../../../src/js/settings/index.js');
    const storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    const wireStorage = () => {
      wireSettingsStorage(
        ...[
          'yourCallsign',
          'yourName',
          'yourState',
          'yourFieldDayClass',
          'yourFieldDaySection',
          'yourSpeed',
          'yourSidetone',
          'yourVolume',
        ].map((id) => document.getElementById(id))
      );
    };
    wireStorage();
    const edits = {
      yourCallsign: 'W1AW',
      yourSpeed: '0.5e2',
      yourSidetone: '7.25e2',
      yourVolume: '3.75e1',
      minStations: '2.9e0',
      maxStations: '6.8e0',
      minSpeed: '1.59e1',
      maxSpeed: '6e1',
      farnsworthSpeed: '1.19e1',
      minTone: '4.105e2',
      maxTone: '8.909e2',
      minVolume: '1.25e1',
      maxVolume: '8.25e1',
      minWait: '5e-1',
      maxWait: '2.25e0',
      qsbPercentage: '7.39e1',
    };
    Object.entries(edits).forEach(([id, value]) => {
      const input = document.getElementById(id);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const beforeReload = getInputs();

    await loadAppHtml();
    wireStorage();
    const afterReload = getInputs();

    expect(beforeReload).toMatchObject({
      yourCallsign: 'W1AW',
      yourSpeed: 50,
      yourSidetone: 725,
      yourVolume: 0.375,
      minStations: 2,
      maxStations: 6,
      minSpeed: 15,
      maxSpeed: 60,
      farnsworthSpeed: 11,
      minTone: 410,
      maxTone: 890,
      minVolume: 0.125,
      maxVolume: 0.825,
      minWait: 0.5,
      maxWait: 2.25,
      qsbPercentage: 73,
    });
    expect(afterReload).toEqual(beforeReload);
    // Your Station keeps its legacy string format; grouped values are numeric.
    expect(storage.peek('yourSpeed')).toBe('0.5e2');
    expect(storage.peek('yourSidetone')).toBe('7.25e2');
    expect(storedPayload(storage, 'respondingStation').values.maxSpeed).toBe(
      60
    );
  });

  it('preserves dependent values while their enabling controls are off', () => {
    const storage = createMemoryStorage();
    const responding = {
      ...respondingValues,
      enableCutNumbers: false,
      enableFarnsworth: false,
      farnsworthSpeed: 14,
    };
    const effects = {
      ...effectsValues,
      qsb: false,
      qsbPercentage: 77,
    };
    applyGroupValues('respondingStation', responding);
    applyGroupValues('effects', effects);

    persistSettingsGroup('respondingStation', storage);
    persistSettingsGroup('effects', storage);
    applyGroupDefaults('respondingStation');
    applyGroupDefaults('effects');
    restoreSettingsGroup('respondingStation', storage);
    restoreSettingsGroup('effects', storage);

    expect(readGroupValues('respondingStation')).toEqual(responding);
    expect(readGroupValues('effects')).toEqual(effects);
  });

  it('never persists or restores an empty callsign-format selection', () => {
    const storage = createMemoryStorage();
    const emptyFormats = {
      ...respondingValues,
      '1x1': false,
    };
    applyGroupValues('respondingStation', emptyFormats);

    persistSettingsGroup('respondingStation', storage);

    expect(document.getElementById('1x1')).not.toBeChecked();
    for (const id of ['1x2', '2x1', '2x2', '1x3', '2x3']) {
      expect(document.getElementById(id)).toBeChecked();
    }
    const persisted = storedPayload(storage, 'respondingStation').values;
    expect(
      ['1x1', '1x2', '2x1', '2x2', '1x3', '2x3'].filter((id) => persisted[id])
    ).toEqual(['1x2', '2x1', '2x2', '1x3', '2x3']);

    storage.setItem(
      PREFERENCE_GROUPS.respondingStation.storageKey,
      JSON.stringify({ values: emptyFormats, version: 1 })
    );
    restoreSettingsGroup('respondingStation', storage);

    expect(document.getElementById('1x1')).not.toBeChecked();
    for (const id of ['1x2', '2x1', '2x2', '1x3', '2x3']) {
      expect(document.getElementById(id)).toBeChecked();
    }
  });

  it.each([
    ['malformed JSON', '{'],
    [
      'an unknown version',
      JSON.stringify({ values: respondingValues, version: 99 }),
    ],
    ['a malformed values object', JSON.stringify({ values: [], version: 1 })],
  ])('uses all HTML defaults for %s', (_description, serialized) => {
    const group = PREFERENCE_GROUPS.respondingStation;
    const storage = createMemoryStorage({ [group.storageKey]: serialized });
    const defaults = readGroupValues('respondingStation');
    applyGroupValues('respondingStation', respondingValues);

    restoreSettingsGroup('respondingStation', storage);

    expect(readGroupValues('respondingStation')).toEqual(defaults);
  });

  it('restores valid fields while defaulting invalid values and ranges', () => {
    const respondingGroup = PREFERENCE_GROUPS.respondingStation;
    const effectsGroup = PREFERENCE_GROUPS.effects;
    const storage = createMemoryStorage({
      [respondingGroup.storageKey]: JSON.stringify({
        values: {
          maxStations: 99,
          minSpeed: 40,
          maxSpeed: 20,
          usOnly: 'false',
          '1x1': true,
          unknownSetting: true,
        },
        version: 1,
      }),
      [effectsGroup.storageKey]: JSON.stringify({
        values: {
          qrn: 'extreme',
          qsb: true,
          qsbPercentage: 101,
        },
        version: 1,
      }),
    });

    restoreSettingsGroup('respondingStation', storage);
    restoreSettingsGroup('effects', storage);

    expect(document.getElementById('maxStations')).toHaveValue(3);
    expect(document.getElementById('minSpeed')).toHaveValue(18);
    expect(document.getElementById('maxSpeed')).toHaveValue(25);
    expect(document.getElementById('usOnly')).toBeChecked();
    expect(document.getElementById('1x1')).toBeChecked();
    expect(document.getElementById('qrnNormal')).toBeChecked();
    expect(document.getElementById('qsb')).toBeChecked();
    expect(document.getElementById('qsbPercentage')).toHaveValue('50');
  });

  it('resets only the selected group and keeps unrelated storage intact', () => {
    const storage = createMemoryStorage({
      mode: 'cwt',
      yourCallsign: 'W1AW',
    });
    applyGroupValues('respondingStation', respondingValues);
    applyGroupValues('effects', effectsValues);
    persistSettingsGroup('respondingStation', storage);
    persistSettingsGroup('effects', storage);
    const effectsPayload = storage.peek(PREFERENCE_GROUPS.effects.storageKey);
    document.getElementById('minSpeed').classList.add('is-invalid');
    document.getElementById('qsb').classList.add('is-invalid');

    resetSettingsGroup('respondingStation', storage);

    expect(
      storage.peek(PREFERENCE_GROUPS.respondingStation.storageKey)
    ).toBeNull();
    expect(storage.peek(PREFERENCE_GROUPS.effects.storageKey)).toBe(
      effectsPayload
    );
    expect(storage.peek('mode')).toBe('cwt');
    expect(storage.peek('yourCallsign')).toBe('W1AW');
    expect(readGroupValues('respondingStation')).toEqual({
      minStations: 0,
      maxStations: 3,
      minSpeed: 18,
      maxSpeed: 25,
      enableFarnsworth: false,
      farnsworthSpeed: 10,
      minTone: 400,
      maxTone: 900,
      minVolume: 30,
      maxVolume: 100,
      minWait: 0.25,
      maxWait: 2,
      usOnly: true,
      '1x1': false,
      '1x2': true,
      '2x1': true,
      '2x2': true,
      '1x3': true,
      '2x3': true,
      enableCutNumbers: false,
      cutT: true,
      cutA: false,
      cutU: false,
      cutV: false,
      cutE: false,
      cutG: false,
      cutD: false,
      cutN: true,
    });
    expect(readGroupValues('effects')).toEqual(effectsValues);
    expect(document.getElementById('minSpeed')).not.toHaveClass('is-invalid');
    expect(document.getElementById('qsb')).toHaveClass('is-invalid');

    resetSettingsGroup('effects', storage);

    expect(storage.peek(PREFERENCE_GROUPS.effects.storageKey)).toBeNull();
    expect(readGroupValues('effects')).toEqual({
      qrn: 'normal',
      qsb: false,
      qsbPercentage: 50,
    });
    expect(document.getElementById('qsb')).not.toHaveClass('is-invalid');
  });

  it('hydrates on startup and saves subsequent input and change events', () => {
    const respondingGroup = PREFERENCE_GROUPS.respondingStation;
    const effectsGroup = PREFERENCE_GROUPS.effects;
    const storage = createMemoryStorage({
      [respondingGroup.storageKey]: JSON.stringify({
        values: respondingValues,
        version: 1,
      }),
      [effectsGroup.storageKey]: JSON.stringify({
        values: effectsValues,
        version: 1,
      }),
      yourCallsign: 'W1AW',
    });
    vi.stubGlobal('localStorage', storage);
    const yourStationElements = [
      'yourCallsign',
      'yourName',
      'yourState',
      'yourFieldDayClass',
      'yourFieldDaySection',
      'yourSpeed',
      'yourSidetone',
      'yourVolume',
    ].map((id) => document.getElementById(id));

    wireSettingsStorage(...yourStationElements);

    expect(document.getElementById('yourCallsign')).toHaveValue('W1AW');
    expect(readGroupValues('respondingStation')).toEqual(respondingValues);
    expect(readGroupValues('effects')).toEqual(effectsValues);

    const maxStations = document.getElementById('maxStations');
    maxStations.value = '9';
    maxStations.dispatchEvent(new Event('input', { bubbles: true }));
    expect(storedPayload(storage, 'respondingStation').values.maxStations).toBe(
      9
    );

    const qrnOff = document.getElementById('qrnOff');
    qrnOff.checked = true;
    qrnOff.dispatchEvent(new Event('change', { bubbles: true }));
    expect(storedPayload(storage, 'effects').values.qrn).toBe('off');

    const callsign = document.getElementById('yourCallsign');
    callsign.value = 'K1ABC';
    callsign.dispatchEvent(new Event('input', { bubbles: true }));
    expect(storage.peek('yourCallsign')).toBe('K1ABC');
  });
});

describe('best-effort storage', () => {
  const groups = [
    { groupId: 'respondingStation', custom: respondingValues },
    { groupId: 'effects', custom: effectsValues },
  ];
  const operations = [
    { name: 'restore', run: restoreSettingsGroup },
    { name: 'persist', run: persistSettingsGroup },
    { name: 'reset', run: resetSettingsGroup },
  ];
  const unavailable = () => {
    throw new globalThis.DOMException('Storage blocked', 'SecurityError');
  };

  it.each(operations)(
    '$name tolerates a throwing global localStorage getter',
    ({ name, run }) => {
      vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(
        unavailable
      );

      const defaults = readGroupValues('respondingStation');
      applyGroupValues('respondingStation', respondingValues);

      expect(() => run('respondingStation')).not.toThrow();
      expect(readGroupValues('respondingStation')).toEqual(
        name === 'persist' ? respondingValues : defaults
      );
    }
  );

  it('wires all fields while the global getter fails and saves after access recovers', () => {
    const storage = createMemoryStorage();
    const getter = vi
      .spyOn(globalThis, 'localStorage', 'get')
      .mockImplementation(unavailable);
    const callsign = document.getElementById('yourCallsign');
    const speed = document.getElementById('yourSpeed');

    expect(() => wireSettingsStorage(callsign, speed)).not.toThrow();
    expect(callsign).toHaveValue('');
    expect(speed).toHaveValue(20);
    expect(document.getElementById('maxStations')).toHaveValue(3);

    getter.mockReturnValue(storage);
    callsign.value = 'W1AW';
    callsign.dispatchEvent(new Event('input', { bubbles: true }));
    speed.value = '32';
    speed.dispatchEvent(new Event('input', { bubbles: true }));
    const maxStations = document.getElementById('maxStations');
    maxStations.value = '7';
    maxStations.dispatchEvent(new Event('input', { bubbles: true }));

    expect(storage.peek('yourCallsign')).toBe('W1AW');
    expect(storage.peek('yourSpeed')).toBe('32');
    expect(storedPayload(storage, 'respondingStation').values.maxStations).toBe(
      7
    );
  });

  it('isolates failed legacy and grouped reads while restoring other keys', () => {
    const storage = createMemoryStorage({
      yourCallsign: 'W1AW',
      yourSpeed: '37',
      [PREFERENCE_GROUPS.respondingStation.storageKey]: JSON.stringify({
        values: respondingValues,
        version: 1,
      }),
      [PREFERENCE_GROUPS.effects.storageKey]: JSON.stringify({
        values: effectsValues,
        version: 1,
      }),
    });
    const read = storage.getItem.getMockImplementation();
    storage.getItem.mockImplementation((key) => {
      if (
        key === 'yourCallsign' ||
        key === PREFERENCE_GROUPS.respondingStation.storageKey
      ) {
        return unavailable();
      }
      return read(key);
    });
    vi.stubGlobal('localStorage', storage);
    const callsign = document.getElementById('yourCallsign');
    const speed = document.getElementById('yourSpeed');

    expect(() => wireSettingsStorage(callsign, speed)).not.toThrow();
    expect(callsign).toHaveValue('');
    expect(speed).toHaveValue(37);
    expect(document.getElementById('maxStations')).toHaveValue(3);
    expect(readGroupValues('effects')).toEqual(effectsValues);

    callsign.value = 'K1ABC';
    callsign.dispatchEvent(new Event('input', { bubbles: true }));
    expect(storage.peek('yourCallsign')).toBe('K1ABC');
  });

  it('keeps wired legacy, numeric, and radio edits usable when writes fail', () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    const callsign = document.getElementById('yourCallsign');
    wireSettingsStorage(callsign);
    storage.setItem.mockImplementation(() => {
      throw new globalThis.DOMException('Storage full', 'QuotaExceededError');
    });
    const errors = [];
    const captureError = (event) => {
      errors.push(event.error);
      event.preventDefault();
    };
    window.addEventListener('error', captureError);
    try {
      callsign.value = 'W1AW';
      callsign.dispatchEvent(new Event('input', { bubbles: true }));
      const maxStations = document.getElementById('maxStations');
      maxStations.value = '7';
      maxStations.dispatchEvent(new Event('input', { bubbles: true }));
      const qrnOff = document.getElementById('qrnOff');
      qrnOff.checked = true;
      qrnOff.dispatchEvent(new Event('change', { bubbles: true }));

      expect(callsign).toHaveValue('W1AW');
      expect(maxStations).toHaveValue(7);
      expect(qrnOff).toBeChecked();
      expect(errors).toEqual([]);
      expect(storage.setItem).toHaveBeenCalledTimes(3);
      expect(storage.peek('yourCallsign')).toBeNull();
      expect(
        storage.peek(PREFERENCE_GROUPS.respondingStation.storageKey)
      ).toBeNull();
      expect(storage.peek(PREFERENCE_GROUPS.effects.storageKey)).toBeNull();
    } finally {
      window.removeEventListener('error', captureError);
    }
  });

  it.each(groups)(
    'resets only $groupId in memory when removeItem throws',
    ({ groupId }) => {
      const defaults = readGroupValues(groupId);
      const otherId = groupId === 'effects' ? 'respondingStation' : 'effects';
      const storage = createMemoryStorage({
        mode: 'cwt',
        yourCallsign: 'W1AW',
      });
      groups.forEach(({ groupId: id, custom }) => {
        applyGroupValues(id, custom);
        persistSettingsGroup(id, storage);
      });
      const otherValues = readGroupValues(otherId);
      const saved = storage.peek(PREFERENCE_GROUPS[groupId].storageKey);
      getPreferenceGroupElements(groupId).forEach((element) => {
        element.classList.add('is-invalid');
      });
      storage.removeItem.mockImplementation(unavailable);

      expect(() => resetSettingsGroup(groupId, storage)).not.toThrow();
      expect(readGroupValues(groupId)).toEqual(defaults);
      expect(readGroupValues(otherId)).toEqual(otherValues);
      getPreferenceGroupElements(groupId).forEach((element) => {
        expect(element).not.toHaveClass('is-invalid');
      });
      expect(storage.peek(PREFERENCE_GROUPS[groupId].storageKey)).toBe(saved);
      expect(storage.peek('mode')).toBe('cwt');
      expect(storage.peek('yourCallsign')).toBe('W1AW');
    }
  );

  it('uses explicitly injected storage without accessing the blocked global getter', () => {
    const getter = vi
      .spyOn(globalThis, 'localStorage', 'get')
      .mockImplementation(unavailable);
    const storage = createMemoryStorage();

    for (const { groupId, custom } of groups) {
      const defaults = readGroupValues(groupId);
      applyGroupValues(groupId, custom);
      persistSettingsGroup(groupId, storage);
      applyGroupDefaults(groupId);
      restoreSettingsGroup(groupId, storage);
      expect(readGroupValues(groupId)).toEqual(custom);
      resetSettingsGroup(groupId, storage);
      expect(readGroupValues(groupId)).toEqual(defaults);
      expect(storage.peek(PREFERENCE_GROUPS[groupId].storageKey)).toBeNull();
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it('retries later operations after transient read, write, and removal failures', () => {
    const storage = createMemoryStorage();
    applyGroupValues('respondingStation', respondingValues);
    storage.setItem.mockImplementationOnce(unavailable);
    expect(() =>
      persistSettingsGroup('respondingStation', storage)
    ).not.toThrow();
    expect(
      storage.peek(PREFERENCE_GROUPS.respondingStation.storageKey)
    ).toBeNull();
    persistSettingsGroup('respondingStation', storage);
    expect(storedPayload(storage, 'respondingStation').values).toEqual(
      respondingValues
    );

    storage.getItem.mockImplementationOnce(unavailable);
    expect(() =>
      restoreSettingsGroup('respondingStation', storage)
    ).not.toThrow();
    expect(document.getElementById('maxStations')).toHaveValue(3);
    restoreSettingsGroup('respondingStation', storage);
    expect(readGroupValues('respondingStation')).toEqual(respondingValues);

    storage.removeItem.mockImplementationOnce(unavailable);
    expect(() =>
      resetSettingsGroup('respondingStation', storage)
    ).not.toThrow();
    expect(document.getElementById('maxStations')).toHaveValue(3);
    expect(
      storage.peek(PREFERENCE_GROUPS.respondingStation.storageKey)
    ).not.toBeNull();
    resetSettingsGroup('respondingStation', storage);
    expect(
      storage.peek(PREFERENCE_GROUPS.respondingStation.storageKey)
    ).toBeNull();
  });

  it('keeps unknown groups and unrelated DOM or serialization errors visible', () => {
    const storage = createMemoryStorage();
    const brokenForm = new Error('Broken form');
    const root = {
      getElementById: () => {
        throw brokenForm;
      },
    };
    for (const { run } of operations) {
      expect(() => run('unknown', storage)).toThrow(RangeError);
      expect(() => run('effects', storage, root)).toThrow(brokenForm);
    }

    const serializationError = new Error('Broken serialization');
    vi.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
      throw serializationError;
    });
    expect(() => persistSettingsGroup('effects', storage)).toThrow(
      serializationError
    );
  });
});
