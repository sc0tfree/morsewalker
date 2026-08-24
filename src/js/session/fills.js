/**
 * Determines whether an exchange field is asking for a fill.
 *
 * @param {unknown} value - Current value of the exchange input.
 * @returns {boolean} Whether the field should be replayed.
 */
export function isFillCandidate(value) {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();

  return normalized === '' || normalized === 'AGN' || normalized.includes('?');
}

/**
 * Selects fillable components in their mode-defined order.
 *
 * @param {Object[]} components - Ordered exchange component descriptors.
 * @param {Object<string, string>} valuesByInputId - Input values keyed by DOM id.
 * @returns {Object[]} The components whose fields request a fill.
 */
export function selectFillComponents(components, valuesByInputId) {
  return components.filter((component) =>
    isFillCandidate(valuesByInputId[component.inputId])
  );
}

/**
 * Builds the operator's request for the selected components.
 *
 * @param {Object[]} selectedComponents - Components selected for replay.
 * @param {Object[]} allComponents - Every component in the current mode.
 * @returns {string} The Morse request to transmit.
 */
export function buildFillRequest(selectedComponents, allComponents) {
  if (selectedComponents.length === 0) return '';

  if (selectedComponents.length === 1) {
    return selectedComponents[0].request;
  }

  if (selectedComponents.length === allComponents.length) {
    return 'AGN?';
  }

  return selectedComponents.map((component) => component.request).join(' ');
}

/**
 * Builds the selected station's response in component order.
 *
 * @param {Object[]} selectedComponents - Components selected for replay.
 * @param {Object} station - The selected calling station.
 * @returns {string} The component-only response.
 */
export function buildFillResponse(selectedComponents, station) {
  return selectedComponents
    .map((component) => String(component.reply(station) ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/**
 * Resolves one AGN action without accessing DOM or session state.
 *
 * @param {Object[]} components - Ordered exchange component descriptors.
 * @param {Object<string, string>} valuesByInputId - Current exchange input values.
 * @param {Object} station - The selected calling station.
 * @returns {Object|null} The selected components and transmission messages.
 */
export function resolveFill(components, valuesByInputId, station) {
  const selectedComponents = selectFillComponents(components, valuesByInputId);
  if (selectedComponents.length === 0) return null;

  return {
    components: selectedComponents,
    request: buildFillRequest(selectedComponents, components),
    response: buildFillResponse(selectedComponents, station),
  };
}
