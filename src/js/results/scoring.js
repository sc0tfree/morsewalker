/**
 * Compares the user's input against a station's corresponding property.
 *
 * Matches the input to attributes like name, state, or serial number, and
 * returns a string indicating correctness. For incorrect matches, shows
 * the expected value.
 *
 * @param {string} fieldKey - The station attribute to compare (e.g., name, state).
 * @param {string} userInput - The user's input value.
 * @param {Object} callingStation - The station object to compare against.
 * @param {number} agnCount - Number of fills requested for this field.
 * @returns {string} A string indicating correctness or showing the expected value.
 */
export function compareExtraInfo(
  fieldKey,
  userInput,
  callingStation,
  agnCount = 0
) {
  if (!fieldKey) return '';

  const agnSuffix = agnCount > 0 ? ` (${agnCount} AGN)` : '';

  // Grab the raw expected value
  let expectedValue = callingStation[fieldKey];

  // Handle numeric fields separately:
  if (fieldKey === 'serialNumber' || fieldKey === 'cwopsNumber') {
    let userValInt = parseInt(userInput, 10);

    // Handle NaN (i.e., empty or non-numeric input)
    if (isNaN(userValInt)) {
      return `<span class="text-warning">
                <i class="fa-solid fa-triangle-exclamation me-1"></i>
              </span> (${expectedValue})${agnSuffix}`;
    }

    let correct = userValInt === Number(expectedValue);
    return correct
      ? `<span class="text-success">
           <i class="fa-solid fa-check me-1"></i><strong>${userValInt}</strong>
         </span>${agnSuffix}`
      : `<span class="text-warning">
           <i class="fa-solid fa-triangle-exclamation me-1"></i>${userValInt}
         </span> (${expectedValue})${agnSuffix}`;
  }

  // For string-based fields (e.g. name, state), force them to string
  let upperExpectedValue = String(expectedValue).toUpperCase();
  userInput = (userInput || '').toUpperCase().trim();

  // Special rule: if both are empty => "N/A"
  if (upperExpectedValue === '') {
    return `N/A${agnSuffix}`;
  }

  // Normal string comparison
  let correct = userInput === upperExpectedValue;
  return correct
    ? `<span class="text-success">
         <i class="fa-solid fa-check me-1"></i><strong>${userInput}</strong>
       </span>${agnSuffix}`
    : `<span class="text-warning">
         <i class="fa-solid fa-triangle-exclamation me-1"></i>${userInput}
       </span> (${upperExpectedValue})${agnSuffix}`;
}
