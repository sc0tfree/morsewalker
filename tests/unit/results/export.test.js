// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildResultsExport } from '../../../src/js/results/export.js';
import { compareExtraInfo } from '../../../src/js/results/scoring.js';
import { addTableRow, clearTable } from '../../../src/js/results/table.js';

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

function exportDate(offset = 300) {
  const date = new Date(
    Date.UTC(2026, 10, 8, 14, 32, 5, 678) + offset * 60_000
  );
  const localValues = {
    getFullYear: 2026,
    getMonth: 10,
    getDate: 8,
    getHours: 14,
    getMinutes: 32,
    getSeconds: 5,
    getTimezoneOffset: offset,
  };
  for (const [method, value] of Object.entries(localValues)) {
    vi.spyOn(date, method).mockReturnValue(value);
  }
  return date;
}

// Read CSV records independently of the exporter's quoting choices.
function readCsv(csv) {
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;
  const content = csv.replace(/^\uFEFF/, '');
  for (let index = 0; index < content.length; index++) {
    const character = content[index];
    if (character === '"') {
      if (quoted && content[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      record.push(field);
      field = '';
    } else if (character === '\r' && content[index + 1] === '\n' && !quoted) {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      index++;
    } else {
      field += character;
    }
  }
  if (record.length || field) records.push([...record, field]);
  return records;
}

function resultTable() {
  return document.getElementById('resultsTable');
}

beforeEach(() => {
  document.body.innerHTML = `
    <button id="exportCsvButton" disabled>Export</button>
    <table id="resultsTable">
      <thead><tr>
        <th>#</th><th>Callsign</th><th>WPM</th><th>Attempts</th>
        <th>Total Time</th><th class="mode-specific-column">Exchange</th>
      </tr></thead>
      <tbody></tbody>
    </table>
  `;
});

describe('results CSV snapshots', () => {
  it('returns no export for an empty or cleared table', () => {
    expect(
      buildResultsExport(resultTable(), 'single', exportDate())
    ).toBeNull();

    addTableRow('resultsTable', 1, 'W6NYC', '24', 1, 1.2);
    clearTable('resultsTable');

    expect(
      buildResultsExport(resultTable(), 'single', exportDate())
    ).toBeNull();
  });

  it('does not count an isolated summary as a completed contact', () => {
    resultTable().tBodies[0].innerHTML =
      '<tr id="resultsTable-summary"><td></td><td>Avg</td></tr>';

    expect(
      buildResultsExport(resultTable(), 'single', exportDate())
    ).toBeNull();
  });

  it.each([
    ['single', 'Single', 'single'],
    ['contest', 'Contest', 'contest'],
    ['fd', 'Field Day', 'field-day'],
    ['pota', 'POTA', 'pota'],
    ['cwt', 'CWT', 'cwt'],
    ['sst', 'SST', 'sst'],
  ])(
    'exports a self-contained %s file with the shared columns',
    (mode, name, slug) => {
      const exchange =
        mode === 'single'
          ? null
          : compareExtraInfo('state', 'AK', { state: 'AK' });
      addTableRow('resultsTable', 1, 'W6NYC', '24', 2, 1.236, exchange);

      const result = buildResultsExport(resultTable(), mode, exportDate());

      expect(result.filename).toBe(
        `2026-11-08_14-32-05_${slug}_morsewalker.csv`
      );
      expect(result.csv.startsWith('\uFEFF')).toBe(true);
      expect(readCsv(result.csv)).toEqual([
        headers,
        [
          '2026-11-08T14:32:05-05:00',
          name,
          '1',
          'W6NYC',
          '24',
          '2',
          '1.24',
          mode === 'single' ? '' : 'Correct: AK',
        ],
      ]);
      expect(result.csv).toContain('\r\n');
      expect(result.csv.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/);
    }
  );

  it.each([
    [0, '+00:00'],
    [-345, '+05:45'],
    [210, '-03:30'],
  ])('records the local UTC offset of %i minutes', (offset, suffix) => {
    addTableRow('resultsTable', 1, 'W6NYC', '24', 1, 2);

    const result = buildResultsExport(
      resultTable(),
      'single',
      exportDate(offset)
    );

    expect(readCsv(result.csv)[1][0]).toBe(`2026-11-08T14:32:05${suffix}`);
    expect(result.filename).toBe('2026-11-08_14-32-05_single_morsewalker.csv');
  });

  it('preserves displayed precision, Farnsworth speeds and newest-first contacts without Avg', () => {
    addTableRow('resultsTable', 1, 'K1AAA', '24 / 12', 3, 12.345);
    addTableRow('resultsTable', 2, 'N2BBB', '18', 1, 2);
    const table = resultTable();
    const before = table.outerHTML;

    const result = buildResultsExport(table, 'single', exportDate());

    expect(readCsv(result.csv).slice(1)).toEqual([
      [
        '2026-11-08T14:32:05-05:00',
        'Single',
        '2',
        'N2BBB',
        '18',
        '1',
        '2.00',
        '',
      ],
      [
        '2026-11-08T14:32:05-05:00',
        'Single',
        '1',
        'K1AAA',
        '24 / 12',
        '3',
        '12.35',
        '',
      ],
    ]);
    expect(table.outerHTML).toBe(before);
    expect(document.getElementById('resultsTable-summary')).toBeInTheDocument();
  });

  it('turns exchange icons into readable statuses while retaining corrections and fills', () => {
    const station = { name: 'ALICE', cwopsNumber: 2468 };
    const exchange = [
      compareExtraInfo('name', 'Alice', station, 2),
      compareExtraInfo('cwopsNumber', '2469', station, 1),
    ].join(' / ');
    addTableRow('resultsTable', 1, 'W6NYC', '24', 1, 2, exchange);
    const before = resultTable().outerHTML;

    const result = buildResultsExport(resultTable(), 'cwt', exportDate());

    expect(readCsv(result.csv)[1][7]).toBe(
      'Correct: ALICE (2 AGN) / Incorrect: 2469 (2468) (1 AGN)'
    );
    expect(result.csv).not.toContain('<');
    expect(resultTable().outerHTML).toBe(before);
    expect(resultTable().querySelectorAll('i')).toHaveLength(2);
  });

  it('retains a missing numeric response and an unavailable exchange component', () => {
    const exchange = [
      compareExtraInfo('cwopsNumber', '', { cwopsNumber: 2468 }, 3),
      compareExtraInfo('state', '', { state: '' }, 1),
    ].join(' / ');
    addTableRow('resultsTable', 1, 'W6NYC', '24', 1, 2, exchange);

    const result = buildResultsExport(resultTable(), 'cwt', exportDate());

    expect(readCsv(result.csv)[1][7]).toBe(
      'Incorrect: (2468) (3 AGN) / N/A (1 AGN)'
    );
  });

  it('quotes commas, double quotes and line breaks without corrupting the CSV', () => {
    const value = 'W6NYC,"portable"\r\nsecond line';
    addTableRow('resultsTable', 1, value, '24', 1, 2);

    const result = buildResultsExport(resultTable(), 'single', exportDate());

    expect(readCsv(result.csv)).toHaveLength(2);
    expect(readCsv(result.csv)[1]).toHaveLength(8);
    expect(readCsv(result.csv)[1][3]).toBe(value);
    expect(result.csv).toContain('"W6NYC,""portable""\r\nsecond line"');
  });

  it.each([
    '=1+1',
    '+1+1',
    '-1+1',
    '@SUM(1)',
    ' \t=1+1',
    '\r\n@SUM(1)',
    '\u0000=1+1',
  ])('exports formula-like text %j as spreadsheet text', (value) => {
    addTableRow('resultsTable', 1, value, '24', 1, 2);

    const result = buildResultsExport(resultTable(), 'single', exportDate());
    const exported = readCsv(result.csv)[1][3];

    expect(exported).toMatch(/^'/);
    expect(exported.slice(1).replaceAll('\u0000', '').trim()).toBe(
      value.replaceAll('\u0000', '').trim()
    );
  });
});
