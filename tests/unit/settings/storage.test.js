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

  it('normalizes integer-consumed fields while preserving decimal settings', () => {
    const storage = createMemoryStorage();
    document.getElementById('maxStations').value = '6.8';
    document.getElementById('minVolume').value = '12.5';
    document.getElementById('minWait').value = '0.6';
    document.getElementById('qsbPercentage').value = '71.9';

    persistSettingsGroup('respondingStation', storage);
    persistSettingsGroup('effects', storage);

    expect(storedPayload(storage, 'respondingStation').values).toMatchObject({
      maxStations: 6,
      minVolume: 12.5,
      minWait: 0.6,
    });
    expect(storedPayload(storage, 'effects').values.qsbPercentage).toBe(71);
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
