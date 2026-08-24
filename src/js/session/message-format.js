/**
 * Applies the selected cut-number substitutions to a transmitted message.
 *
 * Station data remains unmodified; cut numbers are a playback concern and are
 * applied only when a message is assembled for transmission.
 *
 * @param {string} message - The Morse message to format.
 * @param {Object} settings - Current session input settings.
 * @param {boolean} settings.enableCutNumbers - Whether substitutions are active.
 * @param {Object<string, string>} settings.cutNumbers - Digit-to-letter map.
 * @returns {string} The formatted message.
 */
export function applyCutNumbers(
  message,
  { enableCutNumbers = false, cutNumbers = {} } = {}
) {
  if (!enableCutNumbers) return message;

  return message.replace(/\d/g, (digit) => cutNumbers[digit] || digit);
}
