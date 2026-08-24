/**
 * Extracts values from DOM elements representing the form inputs.
 *
 * Collects various input types, including text, dropdowns, checkboxes, and dynamically
 * selected formats. Converts specific fields to standardized formats (e.g., uppercase,
 * float values) to maintain consistency.
 *
 * @returns {Object} An object containing raw input values from the DOM.
 */
export function getDOMInputs() {
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
    yourSpeed: document.getElementById('yourSpeed').valueAsNumber,
    yourSidetone: document.getElementById('yourSidetone').valueAsNumber,
    // convert volume to a float between 0 and 1
    yourVolume: document.getElementById('yourVolume').valueAsNumber / 100,
    maxStations: document.getElementById('maxStations').valueAsNumber,
    minSpeed: document.getElementById('minSpeed').valueAsNumber,
    maxSpeed: document.getElementById('maxSpeed').valueAsNumber,
    minTone: document.getElementById('minTone').valueAsNumber,
    maxTone: document.getElementById('maxTone').valueAsNumber,
    // convert volumes to a float between 0 and 1
    minVolume: document.getElementById('minVolume').valueAsNumber / 100,
    maxVolume: document.getElementById('maxVolume').valueAsNumber / 100,
    minWait: document.getElementById('minWait').valueAsNumber,
    maxWait: document.getElementById('maxWait').valueAsNumber,

    // Checkboxes & Radio
    usOnly: document.getElementById('usOnly')
      ? document.getElementById('usOnly').checked
      : false,
    qrn: document.querySelector('input[name="qrn"]:checked').value,
    qsb: document.getElementById('qsb').checked,
    qsbPercentage: document.getElementById('qsbPercentage').valueAsNumber,

    // Farnsworth inputs
    enableFarnsworth: document.getElementById('enableFarnsworth')
      ? document.getElementById('enableFarnsworth').checked
      : false,
    farnsworthSpeed: document.getElementById('farnsworthSpeed')
      ? document.getElementById('farnsworthSpeed').valueAsNumber
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
