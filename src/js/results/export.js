import { getMode } from '../modes/index.js';

const headers = [
  'Exported At',
  'Mode',
  '#',
  'Callsign',
  'WPM',
  'Attempts',
  'Total Time (s)',
  'Exchange',
];

/** Format one instant as a local timestamp and a filesystem-safe date/time. */
function formatExportTime(date) {
  const pad = (value) => String(value).padStart(2, '0');
  const day = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-');
  const time = [date.getHours(), date.getMinutes(), date.getSeconds()].map(pad);
  const offset = -date.getTimezoneOffset();
  const offsetHours = pad(Math.floor(Math.abs(offset) / 60));
  const offsetMinutes = pad(Math.abs(offset) % 60);
  const zone = `${offset >= 0 ? '+' : '-'}${offsetHours}:${offsetMinutes}`;

  return {
    timestamp: `${day}T${time.join(':')}${zone}`,
    filenameTime: `${day}_${time.join('-')}`,
  };
}

/** Preserve the meaning of exchange feedback without changing the table. */
function exchangeText(cell) {
  if (!cell) return '';

  const copy = cell.cloneNode(true);
  copy.querySelectorAll('.fa-check').forEach((icon) => {
    icon.replaceWith('Correct: ');
  });
  copy.querySelectorAll('.fa-triangle-exclamation').forEach((icon) => {
    icon.replaceWith('Incorrect: ');
  });
  return copy.textContent.replace(/\s+/g, ' ').trim();
}

/** Prevent spreadsheet applications from interpreting text as a formula. */
function protectText(value) {
  // Spreadsheet imports may ignore whitespace and control characters.
  // eslint-disable-next-line no-control-regex
  return /^[\s\u0000-\u001f\u007f]*[=+\-@]/.test(value) ? `'${value}` : value;
}

/** Escape a CSV cell, including embedded quotes and line breaks. */
function escapeCell(value) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Build a CSV snapshot of completed contacts, or null when the table is empty.
 *
 * @param {HTMLTableElement} table - The current results table.
 * @param {string} modeId - The active mode's registry id.
 * @param {Date} exportedAt - The instant used for both filename and row metadata.
 * @returns {{filename: string, csv: string}|null} The export ready to download.
 */
export function buildResultsExport(table, modeId, exportedAt = new Date()) {
  const rows = Array.from(table.tBodies[0].rows).filter(
    (row) => row.id !== `${table.id}-summary`
  );
  if (rows.length === 0) return null;

  const mode = getMode(modeId);
  const { timestamp, filenameTime } = formatExportTime(exportedAt);
  const modeSlug = mode.logic.modeName.toLowerCase().replace(/\s+/g, '-');
  const records = rows.map((row) => {
    const cell = (index) => row.cells[index]?.textContent ?? '';
    return [
      timestamp,
      mode.logic.modeName,
      cell(0),
      protectText(cell(1)),
      protectText(cell(2)),
      cell(3),
      cell(4),
      protectText(mode.ui.tableExtraColumn ? exchangeText(row.cells[5]) : ''),
    ];
  });

  return {
    filename: `${filenameTime}_${modeSlug}_morsewalker.csv`,
    csv:
      '\uFEFF' +
      [headers, ...records]
        .map((record) => record.map(escapeCell).join(','))
        .join('\r\n') +
      '\r\n',
  };
}

/** Download the current results without changing the session or its table. */
export function downloadResultsCsv(modeId) {
  const result = buildResultsExport(
    document.getElementById('resultsTable'),
    modeId
  );
  if (!result) return;

  const blob = new window.Blob([result.csv], {
    type: 'text/csv;charset=utf-8',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.filename;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Give the browser time to begin consuming the download before releasing it.
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  }
}
