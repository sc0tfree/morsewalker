import * as bootstrap from 'bootstrap';

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
  if (!inputs.yourName && inputs.mode === 'sst') {
    markFieldInvalid('yourName', 'Your name is required for SST mode.');
    openAccordionSection('collapseYourStationSettings');
    isValid = false;
  }
  if (!inputs.yourState && inputs.mode === 'sst') {
    markFieldInvalid('yourState', 'Your state is required for SST mode.');
    openAccordionSection('collapseYourStationSettings');
    isValid = false;
  }
  if (!inputs.yourName && inputs.mode === 'cwt') {
    markFieldInvalid('yourName', 'Your name is required for CWT mode.');
    openAccordionSection('collapseYourStationSettings');
    isValid = false;
  }

  if (inputs.minSpeed > inputs.maxSpeed) {
    markFieldInvalid(
      'minSpeed',
      'Minimum Speed cannot be greater than Maximum Speed!'
    );
    openAccordionSection('collapseRespondingStationSettings');
    isValid = false;
  }

  if (inputs.minVolume > inputs.maxVolume) {
    markFieldInvalid(
      'minVolume',
      'Minimum Volume cannot be greater than Maximum Volume!'
    );
    openAccordionSection('collapseRespondingStationSettings');
    isValid = false;
  }

  if (inputs.minSpeed > inputs.maxSpeed) {
    markFieldInvalid(
      'minSpeed',
      'Minimum Speed cannot be greater than Maximum Speed!'
    );
    openAccordionSection('collapseRespondingStationSettings');
    isValid = false;
  }

  return isValid;
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
