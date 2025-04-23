import * as bootstrap from 'bootstrap';

/**
 * Retrieves and validates all input values from the form.
 *
 * Combines DOM input extraction with validation to ensure all required fields
 * meet specified criteria. If the inputs are valid, the collected data is returned;
 * otherwise, it returns `null`.
 *
 * @returns {Object|null} An object containing validated form inputs or null if invalid.
 */
export function getInputs() {
  const inputs = getDOMInputs();
  const valid = validateInputs(inputs);
  return valid ? inputs : null;
}

/**
 * Extracts values from DOM elements representing the form inputs.
 *
 * Collects various input types, including text, dropdowns, checkboxes, and dynamically
 * selected formats. Converts specific fields to standardized formats (e.g., uppercase,
 * float values) to maintain consistency.
 *
 * @returns {Object} An object containing raw input values from the DOM.
 */
function getDOMInputs() {
  return {
    // Dropdowns
    mode: document.querySelector('input[name="mode"]:checked').value,

    // Text and number inputs
    yourCallsign: document
      .getElementById('yourCallsign')
      .value.trim()
      .toUpperCase(),
    yourName: document.getElementById('yourName').value.trim(),
    yourState: document.getElementById('yourState').value.trim().toUpperCase(), // Convert to uppercase for consistency
    yourSpeed: parseInt(document.getElementById('yourSpeed').value, 10),
    yourSidetone: parseInt(document.getElementById('yourSidetone').value, 10),
    // convert volume to a float between 0 and 1
    yourVolume: parseFloat(document.getElementById('yourVolume').value) / 100,
    maxStations: parseInt(document.getElementById('maxStations').value, 10),
    enableContinuous: document.getElementById('enableContinuous')
      ? document.getElementById('enableContinuous').checked
      : false,
    minSpeed: parseInt(document.getElementById('minSpeed').value, 10),
    maxSpeed: parseInt(document.getElementById('maxSpeed').value, 10),
    minTone: parseInt(document.getElementById('minTone').value, 10),
    maxTone: parseInt(document.getElementById('maxTone').value, 10),
    // convert volumes to a float between 0 and 1
    minVolume: parseFloat(document.getElementById('minVolume').value) / 100,
    maxVolume: parseFloat(document.getElementById('maxVolume').value) / 100,
    minWait: parseFloat(document.getElementById('minWait').value),
    maxWait: parseFloat(document.getElementById('maxWait').value),

    // Checkboxes & Radio
    usOnly: document.getElementById('usOnly')
      ? document.getElementById('usOnly').checked
      : false,
    qrn: document.querySelector('input[name="qrn"]:checked').value,
    qsb: document.getElementById('qsb').checked,
    qsbPercentage: parseInt(document.getElementById('qsbPercentage').value, 10),

    // Farnsworth inputs
    enableFarnsworth: document.getElementById('enableFarnsworth')
      ? document.getElementById('enableFarnsworth').checked
      : false,
    farnsworthSpeed: document.getElementById('farnsworthSpeed')
      ? parseInt(document.getElementById('farnsworthSpeed').value, 10)
      : null,

    // Formats (callsign formats are gathered dynamically)
    formats: getSelectedFormats(),

    // Cut number inputs
    enableCutNumbers: document.getElementById('enableCutNumbers')
      ? document.getElementById('enableCutNumbers').checked
      : false,
    cutNumbers: getSelectedCutNumbers(),
  };
}

// Add event listeners to clear invalid states when user types
document.querySelectorAll('input, select, textarea').forEach((el) => {
  el.addEventListener('input', () => {
    clearFieldInvalid(el.id);
  });
});

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
function validateInputs(inputs) {
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
function clearFieldInvalid(inputId) {
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
 * Collects the selected callsign formats from the form.
 *
 * Checks the state of specific checkboxes to determine the selected formats
 * and returns them as an array. Useful for dynamically gathering user preferences
 * for callsign generation.
 *
 * @returns {string[]} An array of selected callsign formats.
 */
function getSelectedFormats() {
  const formats = [];
  if (document.getElementById('1x1').checked) formats.push('1x1');
  if (document.getElementById('1x2').checked) formats.push('1x2');
  if (document.getElementById('1x3').checked) formats.push('1x3');
  if (document.getElementById('2x1').checked) formats.push('2x1');
  if (document.getElementById('2x2').checked) formats.push('2x2');
  if (document.getElementById('2x3').checked) formats.push('2x3');
  return formats;
}

/**
 * Collects the selected cut-number mappings from the form.
 *
 * For each digit the user has chosen to "cut," we store an entry in the returned
 * object that maps that digit to the corresponding letter. For example, if the user
 * checked "T/0" in the UI, then the returned object might include { '0': 'T' }.
 *
 * @example
 * // Suppose checkboxes for T/0 and N/9 are selected.
 * const cutMap = getSelectedCutNumbers();
 * // cutMap -> { '0': 'T', '9': 'N' }
 *
 * // You can then easily replace digits in a string:
 * const original = '80091';
 * const replaced = original.replace(/\d/g, digit => cutMap[digit] || digit);
 * // replaced -> '8TTN1'
 *
 * @returns {Object<string, string>} A dictionary mapping each selected digit
 * to its cut letter. Digits not selected are omitted.
 */
function getSelectedCutNumbers() {
  const cutMap = {};

  if (document.getElementById('cutT')?.checked) {
    cutMap['0'] = 'T';
  }
  if (document.getElementById('cutA')?.checked) {
    cutMap['1'] = 'A';
  }
  if (document.getElementById('cutU')?.checked) {
    cutMap['2'] = 'U';
  }
  if (document.getElementById('cutV')?.checked) {
    cutMap['3'] = 'V';
  }
  if (document.getElementById('cutE')?.checked) {
    cutMap['5'] = 'E';
  }
  if (document.getElementById('cutG')?.checked) {
    cutMap['7'] = 'G';
  }
  if (document.getElementById('cutD')?.checked) {
    cutMap['8'] = 'D';
  }
  if (document.getElementById('cutN')?.checked) {
    cutMap['9'] = 'N';
  }

  return cutMap;
}
