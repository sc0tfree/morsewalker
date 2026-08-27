import * as bootstrap from 'bootstrap';

import { getMode } from '../modes/index.js';

/**
 * Numeric fields whose declared `min` and `max` attributes are enforced.
 */
const NUMERIC_FIELDS = [
  'yourSpeed',
  'yourSidetone',
  'yourVolume',
  'maxStations',
  'minSpeed',
  'maxSpeed',
  'farnsworthSpeed',
  'minTone',
  'maxTone',
  'minVolume',
  'maxVolume',
  'minWait',
  'maxWait',
];

/**
 * Field pairs that describe a range, as `[minId, maxId, message]`.
 */
const ORDERED_PAIRS = [
  ['minSpeed', 'maxSpeed', 'Must be ≤ Max Speed'],
  ['minTone', 'maxTone', 'Must be ≤ Max Tone'],
  ['minVolume', 'maxVolume', 'Must be ≤ Max Volume'],
  ['minWait', 'maxWait', 'Must be ≤ Max Wait'],
];

/**
 * Validates the collected form inputs and ensures their logical consistency.
 *
 * Performs checks for required fields, numerical range constraints, and mode-specific
 * requirements. Marks invalid fields visually and expands the relevant sections
 * of the form for easier user correction.
 *
 * @param {Object} inputs - The collected input data to validate.
 * @returns {boolean} True if all inputs are valid; false otherwise.
 */
export function validateInputs(inputs) {
  const invalid = new Set();

  clearAllInvalidStates();

  const reject = (id, message) => {
    rejectField(id, message);
    invalid.add(id);
  };

  if (!inputs.yourCallsign) {
    reject('yourCallsign', 'Your callsign is required.');
  }

  const requiredOperatorFields =
    getMode(inputs.mode)?.requiredOperatorFields ?? [];
  for (const field of requiredOperatorFields) {
    if (!inputs[field.id]) {
      reject(field.id, field.message);
    } else if (field.validate && !field.validate(inputs[field.id])) {
      reject(field.id, field.invalidMessage ?? field.message);
    }
  }

  for (const id of NUMERIC_FIELDS) {
    const message = getRangeError(document.getElementById(id));
    if (message) {
      reject(id, message);
    }
  }

  // A field already outside its own bounds keeps that more specific message.
  for (const [minId, maxId, message] of ORDERED_PAIRS) {
    if (inputs[minId] > inputs[maxId] && !invalid.has(minId)) {
      reject(minId, message);
    }
  }

  return invalid.size === 0;
}

/**
 * Checks a numeric input against the `min` and `max` it declares.
 *
 * Reads the raw element value rather than the parsed inputs, because collection
 * rescales some fields, such as volumes, away from the units the bounds use.
 * Disabled fields are exempt, since their values are not in play, and a bound
 * the field does not declare is left unenforced rather than coerced to zero.
 *
 * @param {HTMLInputElement|null} input - The input element to check.
 * @returns {string|null} An error message, or null when the value is acceptable.
 */
function getRangeError(input) {
  if (!input || input.disabled) return null;

  const value = Number(input.value);
  if (input.value === '' || Number.isNaN(value)) return 'Required';
  if (input.min !== '' && value < Number(input.min)) {
    return `Must be ≥ ${input.min}`;
  }
  if (input.max !== '' && value > Number(input.max)) {
    return `Must be ≤ ${input.max}`;
  }

  return null;
}

/**
 * Marks a field invalid, displays an error message, and reveals the field.
 *
 * Adds a CSS class for invalid state, updates the associated error message
 * within a `.invalid-feedback` element if present, and expands the accordion
 * section holding the field so the operator can see it.
 *
 * @param {string} inputId - The ID of the input field to reject.
 * @param {string} errorMessage - The error message to display.
 */
function rejectField(inputId, errorMessage) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.classList.add('is-invalid');

  // If there's an associated invalid-feedback element, update its text
  const feedback = input.parentElement.querySelector('.invalid-feedback');
  if (feedback) {
    feedback.textContent = errorMessage;
  }

  openAccordionSection(input.closest('.accordion-collapse'));
}

/**
 * Clears the invalid state from a specific input field.
 *
 * Removes the CSS class for invalid state and resets any associated error message.
 *
 * @param {string} inputId - The ID of the input field to clear.
 */
export function clearFieldInvalid(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.classList.remove('is-invalid');
}

/**
 * Clears the invalid state from all form fields.
 *
 * Targets all elements with the `.is-invalid` class and removes it to reset
 * the visual state of the form.
 */
export function clearAllInvalidStates() {
  // Target all elements with the .is-invalid class
  document
    .querySelectorAll('.is-invalid')
    .forEach((el) => el.classList.remove('is-invalid'));
}

/**
 * Programmatically opens an accordion section.
 *
 * Ensures that the given accordion section is visible by checking its current
 * state and toggling it if necessary. Leverages Bootstrap's `Collapse` API.
 *
 * @param {Element|null} section - The accordion section to open.
 */
function openAccordionSection(section) {
  if (!section || section.classList.contains('show')) return;

  // Programmatically toggle the collapse
  let bsCollapse = bootstrap.Collapse.getInstance(section);
  if (!bsCollapse) {
    bsCollapse = new bootstrap.Collapse(section, { toggle: false });
  }
  bsCollapse.show();
}
