const SETTINGS_STORAGE_VERSION = 1;

const integerControl = (id) => ({ id, key: id, type: 'integer' });
const numberControl = (id) => ({ id, key: id, type: 'number' });
const checkboxControl = (id) => ({ id, key: id, type: 'checkbox' });
const radioControl = (name) => ({ key: name, name, type: 'radio' });

/**
 * Explicit persistence contract for the resettable settings sections.
 *
 * Each registry entry identifies every form control represented by one stored
 * preference. The section IDs also let tests detect new controls that have not
 * been added to this contract.
 */
export const PREFERENCE_GROUPS = {
  respondingStation: {
    controls: [
      integerControl('maxStations'),
      integerControl('minSpeed'),
      integerControl('maxSpeed'),
      checkboxControl('enableFarnsworth'),
      integerControl('farnsworthSpeed'),
      integerControl('minTone'),
      integerControl('maxTone'),
      numberControl('minVolume'),
      numberControl('maxVolume'),
      numberControl('minWait'),
      numberControl('maxWait'),
      checkboxControl('usOnly'),
      checkboxControl('1x1'),
      checkboxControl('1x2'),
      checkboxControl('2x1'),
      checkboxControl('2x2'),
      checkboxControl('1x3'),
      checkboxControl('2x3'),
      checkboxControl('enableCutNumbers'),
      checkboxControl('cutT'),
      checkboxControl('cutA'),
      checkboxControl('cutU'),
      checkboxControl('cutV'),
      checkboxControl('cutE'),
      checkboxControl('cutG'),
      checkboxControl('cutD'),
      checkboxControl('cutN'),
    ],
    orderedPairs: [
      ['minSpeed', 'maxSpeed'],
      ['minTone', 'maxTone'],
      ['minVolume', 'maxVolume'],
      ['minWait', 'maxWait'],
    ],
    requiredSelections: [['1x1', '1x2', '2x1', '2x2', '1x3', '2x3']],
    sectionId: 'collapseRespondingStationSettings',
    storageKey: 'morsewalker.preferences.respondingStation',
    version: SETTINGS_STORAGE_VERSION,
  },
  effects: {
    controls: [
      radioControl('qrn'),
      checkboxControl('qsb'),
      integerControl('qsbPercentage'),
    ],
    orderedPairs: [],
    requiredSelections: [],
    sectionId: 'collapseEffects',
    storageKey: 'morsewalker.preferences.effects',
    version: SETTINGS_STORAGE_VERSION,
  },
};

const yourStationKeys = {
  yourCallsign: 'yourCallsign',
  yourName: 'yourName',
  yourState: 'yourState',
  yourFieldDayClass: 'yourFieldDayClass',
  yourFieldDaySection: 'yourFieldDaySection',
  yourSpeed: 'yourSpeed',
  yourSidetone: 'yourSidetone',
  yourVolume: 'yourVolume',
};

/**
 * Returns a registered preference group or rejects a programming error.
 *
 * @param {string} groupId - Registry key for a preference group.
 * @returns {Object} Registered preference group.
 */
function getPreferenceGroup(groupId) {
  const group = PREFERENCE_GROUPS[groupId];
  if (!group) {
    throw new RangeError(`Unknown preference group: ${groupId}`);
  }
  return group;
}

/**
 * Finds the DOM elements represented by one registry control.
 *
 * @param {Object} group - Preference group registry entry.
 * @param {Object} control - Control registry entry.
 * @param {Document} root - Document containing the settings form.
 * @returns {HTMLInputElement[]} Matching controls in their declared section.
 */
function getControlElements(group, control, root = document) {
  const section = root.getElementById(group.sectionId);
  if (!section) return [];

  if (control.id) {
    const element = root.getElementById(control.id);
    return element && section.contains(element) ? [element] : [];
  }

  return [...section.querySelectorAll(`input[name="${control.name}"]`)];
}

/**
 * Returns every DOM element covered by a preference group registry entry.
 *
 * @param {string} groupId - Registry key for a preference group.
 * @param {Document} root - Document containing the settings form.
 * @returns {HTMLInputElement[]} All registered controls in the group.
 */
export function getPreferenceGroupElements(groupId, root = document) {
  const group = getPreferenceGroup(groupId);
  return group.controls.flatMap((control) =>
    getControlElements(group, control, root)
  );
}

/**
 * Checks a numeric value against the bounds declared in the real form.
 *
 * @param {HTMLInputElement} element - Numeric form control.
 * @param {*} value - Candidate stored value.
 * @returns {boolean} Whether the value can be restored safely.
 */
function isValidNumber(element, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (element.min !== '' && value < Number(element.min)) return false;
  if (element.max !== '' && value > Number(element.max)) return false;
  return true;
}

/**
 * Checks a stored value against its control type and current markup.
 *
 * @param {Object} control - Control registry entry.
 * @param {HTMLInputElement[]} elements - Matching form controls.
 * @param {*} value - Candidate stored value.
 * @returns {boolean} Whether the stored value is recognized.
 */
function isValidControlValue(control, elements, value) {
  if (elements.length === 0) return false;

  if (control.type === 'checkbox') {
    return typeof value === 'boolean';
  }

  if (control.type === 'radio') {
    return (
      typeof value === 'string' &&
      elements.some((element) => element.value === value)
    );
  }

  return (
    isValidNumber(elements[0], value) &&
    (control.type !== 'integer' || Number.isInteger(value))
  );
}

/**
 * Reads a typed preference from its current form control.
 *
 * @param {Object} control - Control registry entry.
 * @param {HTMLInputElement[]} elements - Matching form controls.
 * @returns {*|undefined} Typed value, or undefined when it is currently invalid.
 */
function readControlValue(control, elements) {
  if (elements.length === 0) return undefined;

  if (control.type === 'checkbox') {
    return elements[0].checked;
  }

  if (control.type === 'radio') {
    return elements.find((element) => element.checked)?.value;
  }

  if (elements[0].value === '') return undefined;
  const value =
    control.type === 'integer'
      ? parseInt(elements[0].value, 10)
      : Number(elements[0].value);
  return isValidNumber(elements[0], value) ? value : undefined;
}

/**
 * Applies a typed value to its form control.
 *
 * @param {Object} control - Control registry entry.
 * @param {HTMLInputElement[]} elements - Matching form controls.
 * @param {*} value - Valid value to apply.
 */
function applyControlValue(control, elements, value) {
  if (control.type === 'checkbox') {
    elements[0].checked = value;
    return;
  }

  if (control.type === 'radio') {
    elements.forEach((element) => {
      element.checked = element.value === value;
    });
    return;
  }

  elements[0].value = String(value);
}

/**
 * Restores the defaults declared by the HTML rather than duplicating constants.
 *
 * @param {Object} control - Control registry entry.
 * @param {HTMLInputElement[]} elements - Matching form controls.
 */
function applyControlDefault(control, elements) {
  if (control.type === 'checkbox' || control.type === 'radio') {
    elements.forEach((element) => {
      element.checked = element.defaultChecked;
    });
    return;
  }

  if (elements[0]) {
    elements[0].value = elements[0].defaultValue;
  }
}

/**
 * Parses one versioned preference payload.
 *
 * @param {Storage} storage - Storage implementation.
 * @param {Object} group - Preference group registry entry.
 * @returns {Object|null} Stored values, or null for absent/unreadable data.
 */
function readStoredValues(storage, group) {
  const serialized = storage.getItem(group.storageKey);
  if (serialized === null) return null;

  try {
    const payload = JSON.parse(serialized);
    if (
      payload === null ||
      typeof payload !== 'object' ||
      payload.version !== group.version ||
      payload.values === null ||
      typeof payload.values !== 'object' ||
      Array.isArray(payload.values)
    ) {
      return null;
    }
    return payload.values;
  } catch {
    return null;
  }
}

/**
 * Reverts an invalid ordered range to the HTML defaults as a pair.
 *
 * @param {Object} group - Preference group registry entry.
 * @param {Document} root - Document containing the settings form.
 */
function repairOrderedPairs(group, root = document) {
  group.orderedPairs.forEach(([minimumKey, maximumKey]) => {
    const minimumControl = group.controls.find(
      (control) => control.key === minimumKey
    );
    const maximumControl = group.controls.find(
      (control) => control.key === maximumKey
    );
    const minimumElements = getControlElements(group, minimumControl, root);
    const maximumElements = getControlElements(group, maximumControl, root);

    if (
      minimumElements.length > 0 &&
      maximumElements.length > 0 &&
      Number(minimumElements[0].value) > Number(maximumElements[0].value)
    ) {
      applyControlDefault(minimumControl, minimumElements);
      applyControlDefault(maximumControl, maximumElements);
    }
  });
}

/**
 * Reverts an empty required checkbox selection to its HTML defaults.
 *
 * @param {Object} group - Preference group registry entry.
 * @param {Document} root - Document containing the settings form.
 */
function repairRequiredSelections(group, root = document) {
  group.requiredSelections.forEach((keys) => {
    const controls = keys.map((key) =>
      group.controls.find((control) => control.key === key)
    );
    const selections = controls.map(
      (control) => getControlElements(group, control, root)[0]
    );

    if (selections.some((element) => element?.checked)) return;

    selections.forEach((element) => {
      if (element) {
        element.checked = element.defaultChecked;
      }
    });
    if (!selections.some((element) => element?.checked) && selections[0]) {
      selections[0].checked = true;
    }
  });
}

/**
 * Restores one preference group, using HTML defaults for absent or invalid data.
 *
 * @param {string} groupId - Registry key for a preference group.
 * @param {Storage} storage - Storage implementation.
 * @param {Document} root - Document containing the settings form.
 */
export function restoreSettingsGroup(
  groupId,
  storage = localStorage,
  root = document
) {
  const group = getPreferenceGroup(groupId);
  const storedValues = readStoredValues(storage, group);

  group.controls.forEach((control) => {
    const elements = getControlElements(group, control, root);
    applyControlDefault(control, elements);

    const value = storedValues?.[control.key];
    if (isValidControlValue(control, elements, value)) {
      applyControlValue(control, elements, value);
    }
  });

  repairOrderedPairs(group, root);
  repairRequiredSelections(group, root);
}

/**
 * Saves a typed snapshot of one preference group.
 *
 * Invalid in-progress numeric edits are omitted and return to their HTML
 * defaults if the page is reloaded before the edit is completed.
 *
 * @param {string} groupId - Registry key for a preference group.
 * @param {Storage} storage - Storage implementation.
 * @param {Document} root - Document containing the settings form.
 */
export function persistSettingsGroup(
  groupId,
  storage = localStorage,
  root = document
) {
  const group = getPreferenceGroup(groupId);
  const values = {};

  repairRequiredSelections(group, root);

  group.controls.forEach((control) => {
    const value = readControlValue(
      control,
      getControlElements(group, control, root)
    );
    if (value !== undefined) {
      values[control.key] = value;
    }
  });

  storage.setItem(
    group.storageKey,
    JSON.stringify({ values, version: group.version })
  );
}

/**
 * Clears one saved group and restores its controls to their HTML defaults.
 *
 * @param {string} groupId - Registry key for a preference group.
 * @param {Storage} storage - Storage implementation.
 * @param {Document} root - Document containing the settings form.
 */
export function resetSettingsGroup(
  groupId,
  storage = localStorage,
  root = document
) {
  const group = getPreferenceGroup(groupId);
  storage.removeItem(group.storageKey);

  group.controls.forEach((control) => {
    const elements = getControlElements(group, control, root);
    applyControlDefault(control, elements);
    elements.forEach((element) => {
      element.classList.remove('is-invalid');
    });
  });
}

/**
 * Loads and persists the existing Your Station settings with their legacy keys.
 *
 * @param {HTMLInputElement[]} elements - Your Station controls.
 * @param {Storage} storage - Storage implementation.
 */
function wireYourStationStorage(elements, storage = localStorage) {
  elements.forEach((element) => {
    const key = yourStationKeys[element.id];
    if (!key) return;

    element.value = storage.getItem(key) || element.value;
    element.addEventListener('input', () => {
      storage.setItem(key, element.value);
    });
  });
}

/**
 * Loads all locally persisted settings and saves future changes.
 *
 * Your Station keeps its established scalar keys for backward compatibility.
 * Resettable preference sections use explicit, versioned group payloads.
 *
 * @param {...HTMLInputElement} yourStationElements - Your Station controls.
 */
export function wireSettingsStorage(...yourStationElements) {
  wireYourStationStorage(yourStationElements);

  Object.keys(PREFERENCE_GROUPS).forEach((groupId) => {
    restoreSettingsGroup(groupId);
    getPreferenceGroupElements(groupId).forEach((element) => {
      const eventType =
        element.type === 'checkbox' || element.type === 'radio'
          ? 'change'
          : 'input';
      element.addEventListener(eventType, () => {
        persistSettingsGroup(groupId);
      });
    });
  });
}
