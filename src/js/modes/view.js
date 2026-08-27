import { modeUIConfig } from './index.js';

/**
 * Updates the UI to reflect the current mode's configuration.
 *
 * Adjusts visibility, placeholders, and content of various UI elements like the
 * "TU" button, input fields, and results table. Also modifies extra columns in the
 * results table based on mode-specific requirements.
 *
 * @param {string} mode - The mode to apply settings for.
 */
export function applyModeSettings(mode) {
  const config = modeUIConfig[mode];
  const agnButton = document.getElementById('agnButton');
  const tuButton = document.getElementById('tuButton');
  const infoField = document.getElementById('infoField');
  const infoField2 = document.getElementById('infoField2');
  const resultsTable = document.getElementById('resultsTable');
  const modeResultsHeader = document.getElementById('modeResultsHeader');

  // Exchange action visibility
  agnButton.style.display = config.showAgnButton ? 'inline-block' : 'none';
  tuButton.style.display = config.showTuButton ? 'inline-block' : 'none';

  // Info field visibility & placeholder
  if (config.showInfoField) {
    infoField.style.display = 'inline-block';
    infoField.placeholder = config.infoFieldPlaceholder;
    infoField.setAttribute('aria-label', config.infoFieldPlaceholder);
  } else {
    infoField.style.display = 'none';
    infoField.value = '';
    infoField.placeholder = '';
    infoField.removeAttribute('aria-label');
  }

  // Info field 2 visibility & placeholder
  if (config.showInfoField2) {
    infoField2.style.display = 'inline-block';
    infoField2.placeholder = config.infoField2Placeholder;
    infoField2.setAttribute('aria-label', config.infoField2Placeholder);
  } else {
    infoField2.style.display = 'none';
    infoField2.value = '';
    infoField2.placeholder = '';
    infoField2.removeAttribute('aria-label');
  }

  // Update results header text
  modeResultsHeader.textContent = config.resultsHeader;

  // Show/hide the extra column in the results table
  const extraColumns = resultsTable.querySelectorAll('.mode-specific-column');
  extraColumns.forEach((col) => {
    col.style.display = config.tableExtraColumn ? 'table-cell' : 'none';
  });

  // Update extra column header text
  const extraColumnHeaders = resultsTable.querySelectorAll(
    'thead .mode-specific-column'
  );
  extraColumnHeaders.forEach((header) => {
    header.textContent = config.extraColumnHeader || 'Exchange';
  });
}
