// @vitest-environment jsdom

import { URL as NodeUrl, pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencyMocks = vi.hoisted(() => ({
  createMorsePlayer: vi.fn(),
  getCallingStation: vi.fn(),
  updateAudioLock: vi.fn(),
}));

vi.mock('../../../src/js/audio.js', () => ({
  createMorsePlayer: dependencyMocks.createMorsePlayer,
  updateAudioLock: dependencyMocks.updateAudioLock,
}));

vi.mock('../../../src/js/stationGenerator.js', () => ({
  getCallingStation: dependencyMocks.getCallingStation,
}));

vi.mock('bootstrap', () => ({
  Collapse: class Collapse {},
}));

let addTableRow;
let clearTable;
let updateActiveStations;

function bodyRows() {
  return Array.from(document.querySelector('#resultsTable tbody').rows);
}

async function loadActualAppHtml() {
  const RuntimeUrl = globalThis.URL;

  class FileAwareUrl extends NodeUrl {
    constructor(input, base) {
      if (String(input).endsWith('/src/index.html')) {
        return pathToFileURL(`${process.cwd()}/src/index.html`);
      }

      super(input, base);
    }
  }

  vi.stubGlobal('URL', FileAwareUrl);
  try {
    const { loadAppHtml } = await import('../../helpers/dom.js');
    await loadAppHtml();
  } finally {
    vi.stubGlobal('URL', RuntimeUrl);
  }
}

beforeEach(async () => {
  vi.resetModules();
  await loadActualAppHtml();
  ({ addTableRow, clearTable, updateActiveStations } = await import(
    '../../../src/js/util.js'
  ));
});

describe('result table rows', () => {
  it('inserts a formatted result row with optional mode-specific HTML', () => {
    addTableRow('resultsTable', 7, 'W6NYC', '24', 3, 1.236, '<em>CA</em>');

    const [row] = bodyRows();
    expect(Array.from(row.cells, (cell) => cell.textContent)).toEqual([
      '7',
      'W6NYC',
      '24',
      '3',
      '1.24',
      'CA',
    ]);
    expect(row.cells[5].innerHTML).toBe('<em>CA</em>');
  });

  it('keeps data rows in newest-first order and the summary last', () => {
    addTableRow('resultsTable', 1, 'K1AAA', '20', 1, 1.2);
    addTableRow('resultsTable', 2, 'N2BBB', '30', 2, 2.4);

    const rows = bodyRows();
    expect(rows.map((row) => row.cells[1].textContent)).toEqual([
      'N2BBB',
      'K1AAA',
      'Avg',
    ]);
    expect(rows.at(-1)).toHaveAttribute('id', 'resultsTable-summary');
  });

  it('averages all single-speed result rows', () => {
    addTableRow('resultsTable', 1, 'K1AAA', '18', 1, 1.2);
    addTableRow('resultsTable', 2, 'N2BBB', '24', 3, 2.8);

    const summary = document.getElementById('resultsTable-summary');
    expect(Array.from(summary.cells, (cell) => cell.textContent)).toEqual([
      '',
      'Avg',
      '21.0',
      '2.0',
      '2.00',
      '',
    ]);
  });

  it('averages Farnsworth pairs and treats a single speed as speed/speed', () => {
    addTableRow('resultsTable', 1, 'K1AAA', '20 / 10', 1, 1);
    addTableRow('resultsTable', 2, 'N2BBB', '30', 1, 1);

    expect(
      document.getElementById('resultsTable-summary').cells[2]
    ).toHaveTextContent('25.0 / 20.0');
  });

  it('replaces the existing summary when another result is inserted', () => {
    addTableRow('resultsTable', 1, 'K1AAA', '20', 1, 1);
    addTableRow('resultsTable', 2, 'N2BBB', '30', 1, 1);
    const previousSummary = document.getElementById('resultsTable-summary');

    addTableRow('resultsTable', 3, 'W3CCC', '40', 1, 1);

    const summaries = document.querySelectorAll('#resultsTable-summary');
    const rows = bodyRows();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).not.toBe(previousSummary);
    expect(rows).toHaveLength(4);
    expect(rows.at(-1)).toBe(summaries[0]);
    expect(summaries[0].cells[2]).toHaveTextContent('30.0');
  });

  it('clears data and summary rows together', () => {
    addTableRow('resultsTable', 1, 'K1AAA', '20', 1, 1);
    addTableRow('resultsTable', 2, 'N2BBB', '30', 1, 1);
    expect(bodyRows()).toHaveLength(3);

    clearTable('resultsTable');

    expect(bodyRows()).toHaveLength(0);
    expect(
      document.getElementById('resultsTable-summary')
    ).not.toBeInTheDocument();
  });
});

describe('active station display', () => {
  it('renders the supplied station count as text', () => {
    updateActiveStations(12);
    expect(document.getElementById('activeStations')).toHaveTextContent('12');

    updateActiveStations(0);
    expect(document.getElementById('activeStations')).toHaveTextContent('0');
  });
});
