import { getDOMInputs } from './read.js';
import { clearAllInvalidStates, validateInputs } from './validation.js';
import './controls.js';

export { clearAllInvalidStates };

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
