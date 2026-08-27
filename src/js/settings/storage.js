/**
 * Loads and persists user settings with local storage.
 *
 * @param {HTMLInputElement} yourCallsign - User callsign input.
 * @param {HTMLInputElement} yourName - User name input.
 * @param {HTMLInputElement} yourState - User state input.
 * @param {HTMLInputElement} yourFieldDayClass - User Field Day class input.
 * @param {HTMLInputElement} yourFieldDaySection - User Field Day section input.
 * @param {HTMLInputElement} yourSpeed - User speed input.
 * @param {HTMLInputElement} yourSidetone - User sidetone input.
 * @param {HTMLInputElement} yourVolume - User volume input.
 */
export function wireSettingsStorage(
  yourCallsign,
  yourName,
  yourState,
  yourFieldDayClass,
  yourFieldDaySection,
  yourSpeed,
  yourSidetone,
  yourVolume
) {
  // Local Storage keys for user settings
  const keys = {
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
   * Local storage handling for user settings.
   *
   * - Loads saved values from local storage into input fields during initialization.
   * - Saves updated input field values to local storage whenever they change.
   * - Ensures persistence of user preferences across sessions.
   */
  yourCallsign.value =
    localStorage.getItem(keys.yourCallsign) || yourCallsign.value;
  yourName.value = localStorage.getItem(keys.yourName) || yourName.value;
  yourState.value = localStorage.getItem(keys.yourState) || yourState.value;
  yourFieldDayClass.value =
    localStorage.getItem(keys.yourFieldDayClass) || yourFieldDayClass.value;
  yourFieldDaySection.value =
    localStorage.getItem(keys.yourFieldDaySection) || yourFieldDaySection.value;
  yourSpeed.value = localStorage.getItem(keys.yourSpeed) || yourSpeed.value;
  yourSidetone.value =
    localStorage.getItem(keys.yourSidetone) || yourSidetone.value;
  yourVolume.value = localStorage.getItem(keys.yourVolume) || yourVolume.value;

  // Save user settings to localStorage on input change
  yourCallsign.addEventListener('input', () => {
    localStorage.setItem(keys.yourCallsign, yourCallsign.value);
  });
  yourName.addEventListener('input', () => {
    localStorage.setItem(keys.yourName, yourName.value);
  });
  yourState.addEventListener('input', () => {
    localStorage.setItem(keys.yourState, yourState.value);
  });
  yourFieldDayClass.addEventListener('input', () => {
    localStorage.setItem(keys.yourFieldDayClass, yourFieldDayClass.value);
  });
  yourFieldDaySection.addEventListener('input', () => {
    localStorage.setItem(keys.yourFieldDaySection, yourFieldDaySection.value);
  });
  yourSpeed.addEventListener('input', () => {
    localStorage.setItem(keys.yourSpeed, yourSpeed.value);
  });
  yourSidetone.addEventListener('input', () => {
    localStorage.setItem(keys.yourSidetone, yourSidetone.value);
  });
  yourVolume.addEventListener('input', () => {
    localStorage.setItem(keys.yourVolume, yourVolume.value);
  });
}
