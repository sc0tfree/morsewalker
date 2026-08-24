import * as bootstrap from 'bootstrap';

import { getMode } from '../modes/index.js';

const orderedNumericRanges = [
  {
    minId: 'minSpeed',
    maxId: 'maxSpeed',
  },
  {
    minId: 'minTone',
    maxId: 'maxTone',
  },
  {
    minId: 'minVolume',
    maxId: 'maxVolume',
  },
  {
    minId: 'minWait',
    maxId: 'maxWait',
  },
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
  let isValid = true;

  clearAllInvalidStates();

  if (!inputs.yourCallsign) {
    markFieldInvalid('yourCallsign', 'Your callsign is required.');
    openAccordionSection('collapseYourStationSettings');
    isValid = false;
  }

  const requiredOperatorFields =
    getMode(inputs.mode)?.requiredOperatorFields ?? [];
  for (const field of requiredOperatorFields) {
    if (!inputs[field.id]) {
      markFieldInvalid(field.id, field.message);
      openAccordionSection('collapseYourStationSettings');
      isValid = false;
    }
  }

  for (const input of document.querySelectorAll('input[type="number"]')) {
    if (!input.willValidate || input.validity.valid) continue;

    markFieldInvalid(input.id, getNumericValidationMessage(input));
    openContainingAccordionSection(input);
    isValid = false;
  }

  for (const { minId, maxId } of orderedNumericRanges) {
    const minInput = document.getElementById(minId);
    const maxInput = document.getElementById(maxId);

    if (!minInput.validity.valid || !maxInput.validity.valid) continue;
    if (inputs[minId] <= inputs[maxId]) continue;

    markFieldInvalid(minId, `Must be ≤ ${maxInput.valueAsNumber}`);
    openContainingAccordionSection(minInput);
    isValid = false;
  }

  return isValid;
}

/**
 * Returns concise, deterministic feedback for an invalid numeric input.
 *
 * @param {HTMLInputElement} input - Numeric input to describe.
 * @returns {string} Application-owned validation message.
 */
function getNumericValidationMessage(input) {
  const { validity } = input;

  if (validity.badInput) return 'Must be a number';
  if (validity.valueMissing) return 'Required';
  if (validity.rangeUnderflow) return `Must be ≥ ${input.min}`;
  if (validity.rangeOverflow) return `Must be ≤ ${input.max}`;
  if (validity.stepMismatch) {
    return input.step === '1'
      ? 'Must be integer'
      : `Must use increments of ${input.step}`;
  }

  return 'Invalid value';
}

/**
 * Marks a specific input field as invalid and displays an error message.
 *
 * Adds a CSS class for invalid state and updates the associated error message
 * within a `.invalid-feedback` element if present.
 *
 * @param {string} inputId - The ID of the input field to mark as invalid.
 * @param {string} errorMessage - The error message to display.
 */
function markFieldInvalid(inputId, errorMessage) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.classList.add('is-invalid');

  // If there's an associated invalid-feedback element, update its text
  const feedback = input.parentElement.querySelector('.invalid-feedback');
  if (feedback) {
    feedback.textContent = errorMessage;
  }
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
 * Ensures that the specified accordion section is visible by checking its current
 * state and toggling it if necessary. Leverages Bootstrap's `Collapse` API.
 *
 * @param {string} sectionId - The ID of the accordion section to open.
 */
function openAccordionSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section && !section.classList.contains('show')) {
    // Programmatically toggle the collapse
    let bsCollapse = bootstrap.Collapse.getInstance(section);
    if (!bsCollapse) {
      bsCollapse = new bootstrap.Collapse(section, { toggle: false });
    }
    bsCollapse.show();
  }
}

/**
 * Opens the accordion section containing an invalid input.
 *
 * @param {HTMLInputElement} input - Invalid input whose section should be shown.
 */
function openContainingAccordionSection(input) {
  const section = input.closest('.accordion-collapse');
  if (section) {
    openAccordionSection(section.id);
  }
}
