/* @vitest-environment jsdom */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RecordingAudioContext } from '../../helpers/audioContext.js';

const audioProbe = vi.hoisted(() => ({
  messages: [],
  players: [],
}));
let registeredGlobalListeners = [];

vi.mock('../../../src/js/audio.js', async (importOriginal) => {
  const actual = await importOriginal();
  const mocked = {
    ...actual,
    createMorsePlayer: vi.fn((station, volumeOverride = null) => {
      const player = {
        context: actual.audioContext,
        playSentence: vi.fn((sentence, startTime) => {
          const start = startTime ?? actual.audioContext.currentTime;
          const end = start + 1;

          audioProbe.messages.push({
            callsign: station.callsign,
            sentence,
            start,
            end,
          });

          return end;
        }),
      };

      audioProbe.players.push({
        callsign: station.callsign,
        enableFarnsworth: station.enableFarnsworth,
        farnsworthSpeed: station.farnsworthSpeed,
        player,
        volumeOverride,
        wpm: station.wpm,
      });

      return player;
    }),
  };

  Object.defineProperty(mocked, 'audioContext', {
    configurable: true,
    enumerable: true,
    get: () => actual.audioContext,
  });

  return mocked;
});

function createMemoryStorage(initialValues = {}) {
  const values = new Map(
    Object.entries(initialValues).map(([key, value]) => [
      String(key),
      String(value),
    ])
  );

  return {
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key) => values.get(String(key)) ?? null),
    key: vi.fn((index) => [...values.keys()][index] ?? null),
    removeItem: vi.fn((key) => values.delete(String(key))),
    setItem: vi.fn((key, value) => {
      values.set(String(key), String(value));
    }),
    get length() {
      return values.size;
    },
    peek(key) {
      return values.get(String(key)) ?? null;
    },
  };
}

async function loadSettledAppHtml() {
  const html = await readFile(resolve(process.cwd(), 'src/index.html'), 'utf8');
  document.open();
  document.write(html);
  document.close();

  if (document.readyState === 'loading') {
    await new Promise((resolve) => {
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
  }
}

async function bootSession({ stored = {} } = {}) {
  vi.resetModules();
  audioProbe.messages.length = 0;
  audioProbe.players.length = 0;

  await loadSettledAppHtml();

  const storage = createMemoryStorage(stored);
  const fetchMock = vi.fn(async () => ({
    arrayBuffer: async () => new ArrayBuffer(0),
    ok: true,
  }));

  RecordingAudioContext.instances = [];
  vi.stubGlobal('AudioContext', RecordingAudioContext);
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('localStorage', storage);

  const random = vi.spyOn(Math, 'random').mockReturnValue(0);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.useFakeTimers();

  const listeners = [];
  const originalDocumentAddEventListener =
    document.addEventListener.bind(document);
  const originalWindowAddEventListener = window.addEventListener.bind(window);
  const documentAddEventListener = vi
    .spyOn(document, 'addEventListener')
    .mockImplementation((type, listener, options) => {
      listeners.push({ listener, options, target: document, type });
      return originalDocumentAddEventListener(type, listener, options);
    });
  const windowAddEventListener = vi
    .spyOn(window, 'addEventListener')
    .mockImplementation((type, listener, options) => {
      listeners.push({ listener, options, target: window, type });
      return originalWindowAddEventListener(type, listener, options);
    });

  try {
    await import('../../../src/js/app.js');
    document.dispatchEvent(
      new Event('DOMContentLoaded', { bubbles: true, cancelable: true })
    );
    await Promise.resolve();
  } finally {
    documentAddEventListener.mockRestore();
    windowAddEventListener.mockRestore();
    registeredGlobalListeners.push(...listeners);
  }

  let releasedTime = 0;

  return {
    fetchMock,
    random,
    storage,
    releaseAudio() {
      releasedTime += 100;
      RecordingAudioContext.instances.forEach((context) => {
        context.currentTime = releasedTime;
      });
    },
  };
}

async function settlePromiseChain() {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

function configureValidInputs() {
  document.getElementById('yourCallsign').value = 'N0ME';
  document.getElementById('yourName').value = 'HENRY';
  document.getElementById('yourState').value = 'CA';
  document.getElementById('yourSpeed').value = '20';
  document.getElementById('yourSidetone').value = '600';
  document.getElementById('yourVolume').value = '70';

  document.getElementById('maxStations').value = '1';
  document.getElementById('minSpeed').value = '18';
  document.getElementById('maxSpeed').value = '18';
  document.getElementById('minTone').value = '400';
  document.getElementById('maxTone').value = '400';
  document.getElementById('minVolume').value = '50';
  document.getElementById('maxVolume').value = '50';
  document.getElementById('minWait').value = '0';
  document.getElementById('maxWait').value = '0';

  document.getElementById('qrnOff').checked = true;
  document.getElementById('qsb').checked = false;
  document.getElementById('enableFarnsworth').checked = false;
  document.getElementById('enableCutNumbers').checked = false;

  ['1x1', '1x2', '1x3', '2x1', '2x2', '2x3'].forEach((format) => {
    document.getElementById(format).checked = format === '1x1';
  });
}

function selectMode(mode) {
  const radio = document.querySelector(`input[name="mode"][value="${mode}"]`);
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
}

function selectQrn(level) {
  const ids = {
    heavy: 'qrnHeavy',
    moderate: 'qrnModerate',
    normal: 'qrnNormal',
    off: 'qrnOff',
  };
  const radio = document.getElementById(ids[level]);
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
}

function startSession(mode = 'single') {
  configureValidInputs();
  if (mode !== 'single') {
    selectMode(mode);
  }
  document.getElementById('cqButton').click();
}

function sendResponse(value) {
  document.getElementById('responseField').value = value;
  document.getElementById('sendButton').click();
}

function setInfoValue(id, value) {
  const field = document.getElementById(id);
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  return field;
}

function pressEnter(element) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'Enter',
  });
  element.dispatchEvent(event);
  return event;
}

function transcript() {
  return audioProbe.messages.map(({ callsign, sentence }) => [
    callsign,
    sentence,
  ]);
}

function resultsRows() {
  return [...document.querySelectorAll('#resultsTable tbody tr')];
}

afterEach(() => {
  registeredGlobalListeners.forEach(({ listener, options, target, type }) => {
    target.removeEventListener(type, listener, options);
  });
  registeredGlobalListeners = [];
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  audioProbe.messages.length = 0;
  audioProbe.players.length = 0;
});

describe('session initialization and mode UI', () => {
  it('initializes the real page in default Single mode', async () => {
    const { fetchMock, storage } = await bootSession();

    expect(document.getElementById('modeSingle')).toBeChecked();
    expect(document.getElementById('modeResultsHeader')).toHaveTextContent(
      'Single Mode Results'
    );
    expect(document.getElementById('tuButton')).toHaveStyle({
      display: 'none',
    });
    expect(document.getElementById('agnButton')).toHaveStyle({
      display: 'none',
    });
    expect(document.getElementById('agnButton')).toBeDisabled();
    expect(document.getElementById('infoField')).toHaveStyle({
      display: 'none',
    });
    expect(document.getElementById('infoField2')).toHaveStyle({
      display: 'none',
    });
    expect(
      document.querySelector('#resultsTable .mode-specific-column')
    ).toHaveStyle({ display: 'none' });
    expect(document.getElementById('activeStations')).toHaveTextContent('0');
    expect(document.getElementById('cqButton')).toBeEnabled();
    expect(document.getElementById('qsbPercentage')).toBeDisabled();
    expect(document.getElementById('farnsworthSpeed')).toBeDisabled();
    expect(document.getElementById('cutT')).toBeDisabled();
    expect(storage.peek('mode')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(RecordingAudioContext.instances.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps AGN guidance in the mode-specific card and six-card Help grid', async () => {
    await bootSession();

    expect(document.querySelectorAll('#helpModal .col-xl-4')).toHaveLength(6);

    const infoCard = document.getElementById('modeInfoHelpCard');
    expect(infoCard.closest('.col-xl-4')).not.toBeNull();
    expect(document.getElementById('agnButton')).toHaveClass('btn-warning');
    expect(infoCard.querySelector('button')).toHaveClass('btn-warning');
    expect(infoCard.querySelector('button')).toHaveTextContent('AGN');
    expect(infoCard).toHaveTextContent(
      'Enter the exchange details you copy, such as a name, state, or serial number.'
    );
    expect(infoCard).toHaveTextContent('Need a repeat?');
    expect(infoCard).toHaveTextContent(
      'Leave a field blank, enter AGN, or add ? anywhere in it.'
    );
    expect(infoCard).toHaveTextContent(
      'Click AGN or press Enter before all fields are complete.'
    );
    expect(infoCard).toHaveTextContent(
      'Only those fields repeat. The QSO stays open.'
    );
  });

  it('restores saved mode and station settings and submits startup stats', async () => {
    const { fetchMock, storage } = await bootSession({
      stored: {
        mode: 'cwt',
        yourCallsign: 'N0ME',
        yourName: 'HENRY',
        yourSidetone: '650',
        yourSpeed: '24',
        yourState: 'CA',
        yourVolume: '55',
      },
    });

    expect(document.getElementById('modeCwt')).toBeChecked();
    expect(document.getElementById('modeResultsHeader')).toHaveTextContent(
      'CWT Mode Results'
    );
    expect(document.getElementById('yourCallsign')).toHaveValue('N0ME');
    expect(document.getElementById('yourName')).toHaveValue('HENRY');
    expect(document.getElementById('yourState')).toHaveValue('CA');
    expect(document.getElementById('yourSpeed')).toHaveValue(24);
    expect(document.getElementById('yourSidetone')).toHaveValue(650);
    expect(document.getElementById('yourVolume')).toHaveValue(55);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [statsUrl, statsOptions] = fetchMock.mock.calls[0];
    expect(statsUrl).toMatch(/^https:\/\/stats\..*\/api\/submit$/);
    expect(statsOptions).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(statsOptions.body)).toEqual({
      callsign: 'N0ME',
      mode: 'cwt',
    });

    const callsign = document.getElementById('yourCallsign');
    callsign.value = 'W1AW';
    callsign.dispatchEvent(new Event('input', { bubbles: true }));
    expect(storage.peek('yourCallsign')).toBe('W1AW');

    const state = document.getElementById('yourState');
    state.value = 'CT';
    state.dispatchEvent(new Event('input', { bubbles: true }));
    expect(storage.peek('yourState')).toBe('CT');
  });

  it.each(['retired-mode', 'legacy"]', 'constructor'])(
    'recovers from invalid stored mode "%s" in Single mode',
    async (storedMode) => {
      const { fetchMock, storage } = await bootSession({
        stored: {
          mode: storedMode,
          yourCallsign: 'N0ME',
        },
      });

      expect(document.getElementById('modeSingle')).toBeChecked();
      expect(document.getElementById('modeResultsHeader')).toHaveTextContent(
        'Single Mode Results'
      );
      expect(document.getElementById('tuButton')).toHaveStyle({
        display: 'none',
      });
      expect(
        document.querySelector('#resultsTable .mode-specific-column')
      ).toHaveStyle({ display: 'none' });

      expect(storage.removeItem).toHaveBeenCalledOnce();
      expect(storage.removeItem).toHaveBeenCalledWith('mode');
      expect(storage.peek('mode')).toBeNull();
      expect(storage.peek('yourCallsign')).toBe('N0ME');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, statsOptions] = fetchMock.mock.calls[0];
      expect(JSON.parse(statsOptions.body)).toEqual({
        callsign: 'N0ME',
        mode: 'single',
      });

      startSession();
      expect(transcript()).toEqual([
        ['N0ME', 'CQ DE N0ME K'],
        ['K0A', 'K0A'],
      ]);
    }
  );

  it('applies every mode UI contract through radio changes', async () => {
    const { storage } = await bootSession();
    const cases = [
      {
        extraHeader: 'Additional Info',
        header: 'Single Mode Results',
        info1: null,
        info2: null,
        mode: 'single',
        showAgn: false,
        showExtra: false,
        showTu: false,
      },
      {
        extraHeader: 'Serial Number',
        header: 'Contest Mode Results',
        info1: 'Serial Number',
        info2: null,
        mode: 'contest',
        showAgn: true,
        showExtra: true,
        showTu: true,
      },
      {
        extraHeader: 'State',
        header: 'POTA Mode Results',
        info1: 'State',
        info2: null,
        mode: 'pota',
        showAgn: true,
        showExtra: true,
        showTu: true,
      },
      {
        extraHeader: 'Additional Info',
        header: 'SST Mode Results',
        info1: 'Name',
        info2: 'State',
        mode: 'sst',
        showAgn: true,
        showExtra: true,
        showTu: true,
      },
      {
        extraHeader: 'Additional Info',
        header: 'CWT Mode Results',
        info1: 'Name',
        info2: 'CW Ops No.',
        mode: 'cwt',
        showAgn: true,
        showExtra: true,
        showTu: true,
      },
    ];

    for (const testCase of cases) {
      document.getElementById('responseField').value = 'stale call';
      document.getElementById('infoField').value = 'stale info';
      document.getElementById('infoField2').value = 'stale info 2';

      selectMode(testCase.mode);

      const infoField = document.getElementById('infoField');
      const infoField2 = document.getElementById('infoField2');
      const extraHeader = document.querySelector(
        '#resultsTable thead .mode-specific-column'
      );

      expect(storage.peek('mode')).toBe(testCase.mode);
      expect(document.getElementById('modeResultsHeader')).toHaveTextContent(
        testCase.header
      );
      expect(document.getElementById('tuButton').style.display).toBe(
        testCase.showTu ? 'inline-block' : 'none'
      );
      expect(document.getElementById('agnButton').style.display).toBe(
        testCase.showAgn ? 'inline-block' : 'none'
      );
      expect(document.getElementById('agnButton')).toBeDisabled();
      expect(infoField.style.display).toBe(
        testCase.info1 ? 'inline-block' : 'none'
      );
      expect(infoField.placeholder).toBe(testCase.info1 ?? '');
      expect(infoField2.style.display).toBe(
        testCase.info2 ? 'inline-block' : 'none'
      );
      expect(infoField2.placeholder).toBe(testCase.info2 ?? '');
      expect(extraHeader.style.display).toBe(
        testCase.showExtra ? 'table-cell' : 'none'
      );
      expect(extraHeader).toHaveTextContent(testCase.extraHeader);
      expect(document.getElementById('responseField')).toHaveValue('');
      expect(infoField).toHaveValue('');
      expect(infoField2).toHaveValue('');
      expect(document.getElementById('activeStations')).toHaveTextContent('0');
    }
  });
});

describe('CQ validation', () => {
  it.each([
    {
      feedback: {
        yourCallsign: 'Your callsign is required.',
      },
      label: 'requires a callsign in Single mode',
      mode: 'single',
      mutate() {
        document.getElementById('yourCallsign').value = '';
      },
    },
    {
      feedback: {
        yourName: 'Your name is required for SST mode.',
        yourState: 'Your state is required for SST mode.',
      },
      label: 'requires operator name and state in SST mode',
      mode: 'sst',
      mutate() {
        document.getElementById('yourName').value = '';
        document.getElementById('yourState').value = '';
      },
    },
    {
      feedback: {
        yourName: 'Your name is required for CWT mode.',
      },
      label: 'requires operator name but not state in CWT mode',
      mode: 'cwt',
      mutate() {
        document.getElementById('yourName').value = '';
        document.getElementById('yourState').value = '';
      },
    },
  ])('$label', async ({ feedback, mode, mutate }) => {
    await bootSession();
    configureValidInputs();
    selectMode(mode);
    mutate();

    document.getElementById('cqButton').click();

    for (const [fieldId, message] of Object.entries(feedback)) {
      const field = document.getElementById(fieldId);
      expect(field).toHaveClass('is-invalid');
      expect(
        field.parentElement.querySelector('.invalid-feedback')
      ).toHaveTextContent(message);
    }

    if (mode === 'cwt') {
      expect(document.getElementById('yourState')).not.toHaveClass(
        'is-invalid'
      );
    }

    expect(transcript()).toEqual([]);
    expect(document.getElementById('activeStations')).toHaveTextContent('0');
  });

  it('rejects reversed speed and volume ranges before starting a session', async () => {
    await bootSession();
    configureValidInputs();
    document.getElementById('minSpeed').value = '25';
    document.getElementById('maxSpeed').value = '18';
    document.getElementById('minVolume').value = '80';
    document.getElementById('maxVolume').value = '50';

    document.getElementById('cqButton').click();

    expect(document.getElementById('minSpeed')).toHaveClass('is-invalid');
    expect(
      document
        .getElementById('minSpeed')
        .parentElement.querySelector('.invalid-feedback')
    ).toHaveTextContent('Must be ≤ Max Speed');
    expect(document.getElementById('minVolume')).toHaveClass('is-invalid');
    expect(
      document
        .getElementById('minVolume')
        .parentElement.querySelector('.invalid-feedback')
    ).toHaveTextContent('Must be ≤ Max Volume');
    expect(transcript()).toEqual([]);
  });
});

describe('session controls and message flows', () => {
  it('wires the CQ hotkey and Response Enter key to existing actions', async () => {
    const { releaseAudio } = await bootSession();
    configureValidInputs();

    const cqHotkey = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: 'C',
      shiftKey: true,
    });
    document.dispatchEvent(cqHotkey);

    expect(cqHotkey.defaultPrevented).toBe(true);
    expect(transcript()).toEqual([
      ['N0ME', 'CQ DE N0ME K'],
      ['K0A', 'K0A'],
    ]);
    expect(document.activeElement).toBe(
      document.getElementById('responseField')
    );

    releaseAudio();
    const responseField = document.getElementById('responseField');
    responseField.value = '?';
    const enter = pressEnter(responseField);

    expect(enter.defaultPrevented).toBe(true);
    expect(transcript()).toEqual([
      ['N0ME', 'CQ DE N0ME K'],
      ['K0A', 'K0A'],
      ['N0ME', '?'],
      ['K0A', 'K0A'],
    ]);
  });

  it('completes a deterministic Single contact and starts the next caller', async () => {
    const { releaseAudio } = await bootSession();
    configureValidInputs();

    document.getElementById('cqButton').click();
    releaseAudio();

    const responseField = document.getElementById('responseField');
    responseField.value = 'k0a';
    const enter = pressEnter(responseField);

    expect(enter.defaultPrevented).toBe(true);
    expect(transcript()).toEqual([
      ['N0ME', 'CQ DE N0ME K'],
      ['K0A', 'K0A'],
      ['N0ME', 'K0A'],
      ['N0ME', ' 5NN'],
      ['K0A', 'R 5NN TU'],
      ['N0ME', 'TU EE'],
      ['K0A', 'EE'],
      ['K0A', 'K0A'],
    ]);

    const [row] = resultsRows();
    expect(resultsRows()).toHaveLength(1);
    expect(row.cells).toHaveLength(5);
    expect(row.cells[0]).toHaveTextContent('1');
    expect(row.cells[1]).toHaveTextContent('K0A');
    expect(row.cells[2]).toHaveTextContent('18');
    expect(row.cells[3]).toHaveTextContent('1');
    expect(Number(row.cells[4].textContent)).toBeGreaterThan(0);
    expect(document.getElementById('activeStations')).toHaveTextContent('1');
    expect(document.getElementById('cqButton')).toBeDisabled();
    expect(responseField).toHaveValue('');
    expect(document.activeElement).toBe(responseField);
  });

  it.each([
    {
      cqMessage: 'CQ TEST DE N0ME',
      extraText: '1',
      info1: '01',
      info2: '',
      mode: 'contest',
      sendMessages: [
        ['N0ME', 'K0A'],
        ['N0ME', ' 5NN'],
        ['K0A', '5NN 01 TU'],
      ],
      signoffMessages: [['N0ME', 'TU N0ME']],
    },
    {
      cqMessage: 'CQ POTA DE N0ME',
      extraText: 'AL',
      info1: 'AL',
      info2: '',
      mode: 'pota',
      sendMessages: [
        ['N0ME', 'K0A'],
        ['N0ME', ' UR 5NN <BK>'],
        ['K0A', '<BK> UR 5NN AL AL <BK>'],
      ],
      signoffMessages: [
        ['N0ME', '<BK> TU AL 73 EE'],
        ['K0A', 'EE'],
      ],
    },
    {
      cqMessage: 'CQ SST N0ME',
      extraText: 'ADAM / AL',
      info1: 'Adam',
      info2: 'AL',
      mode: 'sst',
      sendMessages: [
        ['N0ME', 'K0A'],
        ['N0ME', ' HENRY CA'],
        ['K0A', 'TU HENRY Adam AL'],
      ],
      signoffMessages: [['N0ME', 'GL Adam TU N0ME SST']],
    },
    {
      cqMessage: 'CQ CWT N0ME',
      extraText: 'ADAM / 1',
      info1: 'Adam',
      info2: '1',
      mode: 'cwt',
      sendMessages: [
        ['N0ME', 'K0A'],
        ['N0ME', ' HENRY CWA'],
        ['K0A', 'Adam 1 TU'],
      ],
      signoffMessages: [['N0ME', 'TU N0ME']],
    },
  ])(
    'completes the $mode CQ, Send, and TU message contract',
    async ({
      cqMessage,
      extraText,
      info1,
      info2,
      mode,
      sendMessages,
      signoffMessages,
    }) => {
      const { random, releaseAudio } = await bootSession();
      configureValidInputs();
      selectMode(mode);

      document.getElementById('cqButton').click();
      expect(transcript()).toEqual([
        ['N0ME', cqMessage],
        ['K0A', 'K0A'],
      ]);

      releaseAudio();
      const responseField = document.getElementById('responseField');
      responseField.value = 'k0a';
      expect(pressEnter(responseField).defaultPrevented).toBe(true);
      expect(transcript()).toEqual([
        ['N0ME', cqMessage],
        ['K0A', 'K0A'],
        ...sendMessages,
      ]);
      expect(document.activeElement).toBe(document.getElementById('infoField'));

      releaseAudio();
      random.mockReturnValue(0.9);
      document.getElementById('infoField').value = info1;
      document.getElementById('infoField2').value = info2;
      const finalInfoField = info2
        ? document.getElementById('infoField2')
        : document.getElementById('infoField');
      expect(pressEnter(finalInfoField).defaultPrevented).toBe(true);

      expect(transcript()).toEqual([
        ['N0ME', cqMessage],
        ['K0A', 'K0A'],
        ...sendMessages,
        ...signoffMessages,
      ]);

      const [row] = resultsRows();
      expect(resultsRows()).toHaveLength(1);
      expect(row.cells).toHaveLength(6);
      expect(row.cells[0]).toHaveTextContent('1');
      expect(row.cells[1]).toHaveTextContent('K0A');
      expect(row.cells[2]).toHaveTextContent('18');
      expect(row.cells[3]).toHaveTextContent('1');
      expect(row.cells[5]).toHaveTextContent(extraText);
      expect(document.getElementById('activeStations')).toHaveTextContent('0');
      expect(responseField).toHaveValue('');
      expect(document.getElementById('infoField')).toHaveValue('');
      expect(document.getElementById('infoField2')).toHaveValue('');
      expect(document.activeElement).toBe(responseField);
    }
  );

  it.each([
    {
      completedFieldId: 'infoField',
      expectedExtra: 'ADAM / 1 (1 AGN)',
      expectedRequest: 'NR?',
      expectedResponse: '1',
      label: 'CW Ops number',
      missingFieldId: 'infoField2',
    },
    {
      completedFieldId: 'infoField2',
      expectedExtra: 'ADAM (1 AGN) / 1',
      expectedRequest: 'NAME?',
      expectedResponse: 'Adam',
      label: 'name',
      missingFieldId: 'infoField',
    },
  ])(
    'routes Enter from a completed field to the missing CWT $label',
    async ({
      completedFieldId,
      expectedExtra,
      expectedRequest,
      expectedResponse,
      missingFieldId,
    }) => {
      const { random, releaseAudio } = await bootSession();
      startSession('cwt');
      releaseAudio();
      sendResponse('K0A');
      releaseAudio();

      setInfoValue('infoField', missingFieldId === 'infoField' ? '' : 'Adam');
      setInfoValue('infoField2', missingFieldId === 'infoField2' ? '' : '1');
      const completedField = document.getElementById(completedFieldId);
      const missingField = document.getElementById(missingFieldId);
      completedField.focus();

      const enterForAgn = pressEnter(completedField);

      expect(enterForAgn.defaultPrevented).toBe(true);
      expect(transcript().slice(-2)).toEqual([
        ['N0ME', expectedRequest],
        ['K0A', expectedResponse],
      ]);
      expect(resultsRows()).toHaveLength(0);
      expect(document.getElementById('activeStations')).toHaveTextContent('1');
      expect(missingField).toHaveValue('');
      expect(document.activeElement).toBe(missingField);

      releaseAudio();
      setInfoValue('infoField', 'Adam');
      setInfoValue('infoField2', '1');
      random.mockReturnValue(0.9);

      const enterForTu = pressEnter(missingField);

      expect(enterForTu.defaultPrevented).toBe(true);
      expect(resultsRows()).toHaveLength(1);
      expect(resultsRows()[0].cells[5]).toHaveTextContent(expectedExtra);
    }
  );

  it.each([
    {
      candidate: '',
      expectedExtra: 'ADAM / 1 (1 AGN)',
      expectedRequest: 'NR?',
      expectedResponse: '1',
      fieldId: 'infoField2',
      label: 'a blank number',
    },
    {
      candidate: 'AGN',
      expectedExtra: 'ADAM (1 AGN) / 1',
      expectedRequest: 'NAME?',
      expectedResponse: 'Adam',
      fieldId: 'infoField',
      label: 'AGN in the name',
    },
    {
      candidate: 'AGN?',
      expectedExtra: 'ADAM / 1 (1 AGN)',
      expectedRequest: 'NR?',
      expectedResponse: '1',
      fieldId: 'infoField2',
      label: 'AGN? in the number',
    },
    {
      candidate: 'AD?M',
      expectedExtra: 'ADAM (1 AGN) / 1',
      expectedRequest: 'NAME?',
      expectedResponse: 'Adam',
      fieldId: 'infoField',
      label: 'a question-marked name',
    },
  ])(
    'routes Enter through AGN for $label, then allows normal Enter to TU',
    async ({
      candidate,
      expectedExtra,
      expectedRequest,
      expectedResponse,
      fieldId,
    }) => {
      const { random, releaseAudio } = await bootSession();
      startSession('cwt');
      releaseAudio();
      sendResponse('K0A');
      releaseAudio();

      setInfoValue('infoField', fieldId === 'infoField' ? candidate : 'Adam');
      setInfoValue('infoField2', fieldId === 'infoField2' ? candidate : '1');
      const candidateField = document.getElementById(fieldId);
      candidateField.focus();

      const enterForAgn = pressEnter(candidateField);

      expect(enterForAgn.defaultPrevented).toBe(true);
      expect(transcript().slice(-2)).toEqual([
        ['N0ME', expectedRequest],
        ['K0A', expectedResponse],
      ]);
      expect(resultsRows()).toHaveLength(0);
      expect(document.getElementById('activeStations')).toHaveTextContent('1');
      expect(candidateField).toHaveValue(candidate);
      expect(document.activeElement).toBe(candidateField);

      releaseAudio();
      setInfoValue('infoField', 'Adam');
      const finalField = setInfoValue('infoField2', '1');
      random.mockReturnValue(0.9);

      const enterForTu = pressEnter(finalField);

      expect(enterForTu.defaultPrevented).toBe(true);
      expect(resultsRows()).toHaveLength(1);
      expect(resultsRows()[0].cells[3]).toHaveTextContent('2');
      expect(resultsRows()[0].cells[5]).toHaveTextContent(expectedExtra);
      expect(document.getElementById('activeStations')).toHaveTextContent('0');
    }
  );

  it('replays only the blank CWT field and preserves the active QSO', async () => {
    const { random, releaseAudio } = await bootSession();
    startSession('cwt');

    const agnButton = document.getElementById('agnButton');
    expect(agnButton).toBeDisabled();

    releaseAudio();
    sendResponse('K0A');
    expect(agnButton).toBeEnabled();

    releaseAudio();
    const nameField = setInfoValue('infoField', 'Adam');
    const numberField = document.getElementById('infoField2');
    nameField.focus();
    agnButton.click();

    expect(transcript().slice(-2)).toEqual([
      ['N0ME', 'NR?'],
      ['K0A', '1'],
    ]);
    expect(resultsRows()).toHaveLength(0);
    expect(document.getElementById('activeStations')).toHaveTextContent('1');
    expect(document.getElementById('infoField')).toHaveValue('Adam');
    expect(numberField).toHaveValue('');
    expect(document.activeElement).toBe(nameField);
    expect(agnButton).toBeEnabled();

    releaseAudio();
    setInfoValue('infoField2', '1');
    expect(agnButton).toBeDisabled();

    const completedTranscript = transcript();
    agnButton.click();
    expect(transcript()).toEqual(completedTranscript);

    random.mockReturnValue(0.9);
    document.getElementById('tuButton').click();

    expect(resultsRows()).toHaveLength(1);
    expect(resultsRows()[0].cells[3]).toHaveTextContent('2');
    expect(resultsRows()[0].cells[5]).toHaveTextContent('ADAM / 1 (1 AGN)');
  });

  it('uses one AGN? request when every CWT field is blank', async () => {
    const { random, releaseAudio } = await bootSession();
    startSession('cwt');
    releaseAudio();
    sendResponse('K0A');
    releaseAudio();

    const agnButton = document.getElementById('agnButton');
    agnButton.click();

    expect(transcript().slice(-2)).toEqual([
      ['N0ME', 'AGN?'],
      ['K0A', 'Adam 1'],
    ]);
    expect(document.getElementById('infoField')).toHaveValue('');
    expect(document.getElementById('infoField2')).toHaveValue('');
    expect(resultsRows()).toHaveLength(0);
    expect(document.getElementById('activeStations')).toHaveTextContent('1');

    releaseAudio();
    agnButton.click();
    expect(transcript().slice(-4)).toEqual([
      ['N0ME', 'AGN?'],
      ['K0A', 'Adam 1'],
      ['N0ME', 'AGN?'],
      ['K0A', 'Adam 1'],
    ]);

    releaseAudio();
    setInfoValue('infoField', 'Adam');
    setInfoValue('infoField2', '1');
    random.mockReturnValue(0.9);
    document.getElementById('tuButton').click();

    expect(resultsRows()).toHaveLength(1);
    expect(resultsRows()[0].cells[3]).toHaveTextContent('3');
    expect(resultsRows()[0].cells[5]).toHaveTextContent(
      'ADAM (2 AGN) / 1 (2 AGN)'
    );
  });

  it('uses the canonical request and cut numbers for a one-field AGN fill', async () => {
    const { releaseAudio } = await bootSession();
    configureValidInputs();
    selectMode('contest');

    const enableCutNumbers = document.getElementById('enableCutNumbers');
    enableCutNumbers.checked = true;
    enableCutNumbers.dispatchEvent(new Event('change', { bubbles: true }));

    document.getElementById('cqButton').click();
    releaseAudio();
    sendResponse('K0A');
    releaseAudio();
    document.getElementById('agnButton').click();

    expect(transcript().slice(-2)).toEqual([
      ['N0ME', 'NR?'],
      ['K0A', 'T1'],
    ]);
  });

  it('starts field AGN counts fresh after Reset', async () => {
    const { random, releaseAudio } = await bootSession();
    startSession('cwt');
    releaseAudio();
    sendResponse('K0A');
    releaseAudio();
    document.getElementById('agnButton').click();
    releaseAudio();

    document.getElementById('resetButton').click();
    expect(document.getElementById('agnButton')).toBeDisabled();

    document.getElementById('cqButton').click();
    releaseAudio();
    sendResponse('K0A');
    releaseAudio();
    document.getElementById('agnButton').click();
    releaseAudio();

    setInfoValue('infoField', 'Adam');
    setInfoValue('infoField2', '1');
    random.mockReturnValue(0.9);
    document.getElementById('tuButton').click();

    expect(resultsRows()[0].cells[5]).toHaveTextContent(
      'ADAM (1 AGN) / 1 (1 AGN)'
    );
  });

  it('starts field AGN counts fresh after a mode change', async () => {
    const { random, releaseAudio } = await bootSession();
    startSession('cwt');
    releaseAudio();
    sendResponse('K0A');
    releaseAudio();
    document.getElementById('agnButton').click();
    releaseAudio();

    selectMode('sst');
    expect(document.getElementById('agnButton')).toBeDisabled();

    document.getElementById('cqButton').click();
    releaseAudio();
    sendResponse('K0A');
    releaseAudio();
    document.getElementById('agnButton').click();
    releaseAudio();

    setInfoValue('infoField', 'Adam');
    setInfoValue('infoField2', 'AL');
    random.mockReturnValue(0.9);
    document.getElementById('tuButton').click();

    expect(resultsRows()[0].cells[5]).toHaveTextContent(
      'ADAM (1 AGN) / AL (1 AGN)'
    );
  });

  it('clears field AGN counts when Stop resets active audio', async () => {
    const { random, releaseAudio } = await bootSession();
    startSession('cwt');
    releaseAudio();
    sendResponse('K0A');
    releaseAudio();
    document.getElementById('agnButton').click();
    releaseAudio();

    document.getElementById('stopButton').click();
    document.getElementById('agnButton').click();
    releaseAudio();

    setInfoValue('infoField', 'Adam');
    setInfoValue('infoField2', '1');
    random.mockReturnValue(0.9);
    document.getElementById('tuButton').click();

    expect(resultsRows()[0].cells[5]).toHaveTextContent(
      'ADAM (1 AGN) / 1 (1 AGN)'
    );
  });

  it.each([
    ['single', 'CQ DE N0ME K'],
    ['contest', 'CQ TEST DE N0ME'],
  ])(
    'uses empty Send to start $mode, then ignores it while a caller is active',
    async (mode, cqMessage) => {
      const { releaseAudio } = await bootSession();
      configureValidInputs();
      if (mode !== 'single') {
        selectMode(mode);
      }

      document.getElementById('sendButton').click();
      const activeTranscript = [
        ['N0ME', cqMessage],
        ['K0A', 'K0A'],
      ];
      expect(transcript()).toEqual(activeTranscript);

      releaseAudio();
      document.getElementById('sendButton').click();
      expect(transcript()).toEqual(activeTranscript);
      expect(document.getElementById('activeStations')).toHaveTextContent('1');
    }
  );

  it.each([
    {
      afterWrong: [
        ['N0ME', 'CQ DE N0ME K'],
        ['K0A', 'K0A'],
        ['N0ME', 'ZZ9ZZ'],
        ['K0A', 'K0A'],
      ],
      mode: 'single',
    },
    {
      afterWrong: [
        ['N0ME', 'CQ TEST DE N0ME'],
        ['K0A', 'K0A'],
        ['N0ME', 'ZZ9ZZ'],
      ],
      mode: 'contest',
    },
  ])(
    'records a wrong $mode response as another attempt',
    async ({ afterWrong, mode }) => {
      const { random, releaseAudio } = await bootSession();
      startSession(mode);
      releaseAudio();

      sendResponse('ZZ9ZZ');
      expect(transcript()).toEqual(afterWrong);
      expect(resultsRows()).toHaveLength(0);

      releaseAudio();
      sendResponse('K0A');

      if (mode === 'contest') {
        releaseAudio();
        random.mockReturnValue(0.9);
        document.getElementById('infoField').value = '01';
        document.getElementById('tuButton').click();
      }

      expect(resultsRows()).toHaveLength(1);
      expect(resultsRows()[0].cells[3]).toHaveTextContent('2');
    }
  );

  it.each([
    { criterion: 'criterion 1 prefix', response: 'K0' },
    { criterion: 'criterion 4 extended prefix', response: 'K0AXX' },
    { criterion: 'criterion 5 substitution', response: 'K0X' },
  ])(
    'repeats a contest caller matching $criterion without advancing',
    async ({ response }) => {
      const { random, releaseAudio } = await bootSession();
      startSession('contest');
      releaseAudio();

      sendResponse(response);
      expect(transcript()).toEqual([
        ['N0ME', 'CQ TEST DE N0ME'],
        ['K0A', 'K0A'],
        ['N0ME', response],
        ['K0A', 'K0A'],
      ]);
      expect(resultsRows()).toHaveLength(0);
      expect(document.getElementById('activeStations')).toHaveTextContent('1');

      releaseAudio();
      const beforeEarlyTu = transcript();
      document.getElementById('tuButton').click();
      expect(transcript()).toEqual(beforeEarlyTu);
      expect(resultsRows()).toHaveLength(0);

      sendResponse('K0A');
      expect(transcript().slice(-3)).toEqual([
        ['N0ME', 'K0A'],
        ['N0ME', ' 5NN'],
        ['K0A', '5NN 01 TU'],
      ]);

      releaseAudio();
      random.mockReturnValue(0.9);
      document.getElementById('infoField').value = '01';
      document.getElementById('tuButton').click();

      expect(resultsRows()).toHaveLength(1);
      expect(resultsRows()[0].cells[3]).toHaveTextContent('2');
    }
  );

  it.each(['?', 'AGN', 'AGN?'])(
    'repeats the pileup for the %s request',
    async (repeatRequest) => {
      const { releaseAudio } = await bootSession();
      startSession('contest');
      releaseAudio();

      sendResponse(repeatRequest);

      expect(transcript()).toEqual([
        ['N0ME', 'CQ TEST DE N0ME'],
        ['K0A', 'K0A'],
        ['N0ME', repeatRequest],
        ['K0A', 'K0A'],
      ]);
      expect(resultsRows()).toHaveLength(0);
      expect(document.getElementById('activeStations')).toHaveTextContent('1');
    }
  );

  it('slows the last responding pileup on repeated QRS requests', async () => {
    const { releaseAudio } = await bootSession();
    startSession('contest');

    expect(
      audioProbe.players.filter(({ callsign }) => callsign === 'K0A').at(-1)
    ).toMatchObject({
      enableFarnsworth: false,
      farnsworthSpeed: 10,
      wpm: 18,
    });

    releaseAudio();
    sendResponse('QRS');
    expect(
      audioProbe.players.filter(({ callsign }) => callsign === 'K0A').at(-1)
    ).toMatchObject({
      enableFarnsworth: true,
      farnsworthSpeed: 12,
      wpm: 18,
    });

    releaseAudio();
    sendResponse('QRS');
    expect(
      audioProbe.players.filter(({ callsign }) => callsign === 'K0A').at(-1)
    ).toMatchObject({
      enableFarnsworth: true,
      farnsworthSpeed: 6,
      wpm: 18,
    });
    expect(transcript()).toEqual([
      ['N0ME', 'CQ TEST DE N0ME'],
      ['K0A', 'K0A'],
      ['N0ME', 'QRS'],
      ['K0A', 'K0A'],
      ['N0ME', 'QRS'],
      ['K0A', 'K0A'],
    ]);
  });

  it.each(['single', 'contest'])(
    'treats an exact $mode callsign containing ? as uncertain',
    async (mode) => {
      const { random, releaseAudio } = await bootSession();
      startSession(mode);
      releaseAudio();

      sendResponse('K0A?');
      expect(transcript().slice(-2)).toEqual([
        ['N0ME', 'K0A?'],
        ['K0A', 'RR'],
      ]);
      expect(resultsRows()).toHaveLength(0);

      releaseAudio();
      if (mode === 'contest') {
        const beforeEarlyTu = transcript();
        document.getElementById('tuButton').click();
        expect(transcript()).toEqual(beforeEarlyTu);
        expect(resultsRows()).toHaveLength(0);
      }

      sendResponse('K0A');
      if (mode === 'contest') {
        releaseAudio();
        random.mockReturnValue(0.9);
        document.getElementById('infoField').value = '01';
        document.getElementById('tuButton').click();
      }

      expect(resultsRows()).toHaveLength(1);
      expect(resultsRows()[0].cells[3]).toHaveTextContent('2');
    }
  );

  it('blocks CQ, Send, AGN, and TU during audio and guards repeated actions', async () => {
    const { random, releaseAudio } = await bootSession();
    startSession('contest');
    const callingTranscript = transcript();

    document.getElementById('cqButton').click();
    sendResponse('K0A');
    expect(transcript()).toEqual(callingTranscript);

    releaseAudio();
    sendResponse('K0A');
    const readyTranscript = transcript();
    document.getElementById('agnButton').click();
    sendResponse('K0A');
    document.getElementById('infoField').value = '01';
    document.getElementById('tuButton').click();
    expect(transcript()).toEqual(readyTranscript);
    expect(resultsRows()).toHaveLength(0);

    releaseAudio();
    random.mockReturnValue(0.9);
    document.getElementById('tuButton').click();
    const completedTranscript = transcript();
    expect(resultsRows()).toHaveLength(1);

    document.getElementById('tuButton').click();
    expect(transcript()).toEqual(completedTranscript);
    expect(resultsRows()).toHaveLength(1);

    releaseAudio();
    document.getElementById('tuButton').click();
    expect(transcript()).toEqual(completedTranscript);
    expect(resultsRows()).toHaveLength(1);
  });

  it.each([
    { activeAfterStop: '0', mode: 'single', sendContinues: false },
    { activeAfterStop: '1', mode: 'contest', sendContinues: true },
  ])(
    'Stop resets audio while preserving the current $mode station semantics',
    async ({ activeAfterStop, mode, sendContinues }) => {
      await bootSession();
      startSession(mode);
      const beforeStop = transcript();
      const contextBeforeStop = RecordingAudioContext.instances.at(-1);
      const contextCountBeforeStop = RecordingAudioContext.instances.length;

      document.getElementById('stopButton').click();

      expect(contextBeforeStop.closed).toBe(true);
      expect(RecordingAudioContext.instances).toHaveLength(
        contextCountBeforeStop + 1
      );
      expect(document.getElementById('cqButton')).toBeEnabled();
      expect(document.getElementById('activeStations')).toHaveTextContent(
        activeAfterStop
      );
      expect(transcript()).toEqual(beforeStop);

      sendResponse('K0A');
      if (sendContinues) {
        expect(transcript().slice(-3)).toEqual([
          ['N0ME', 'K0A'],
          ['N0ME', ' 5NN'],
          ['K0A', '5NN 01 TU'],
        ]);
      } else {
        expect(transcript()).toEqual(beforeStop);
      }
    }
  );

  it('accepts immediate CQ while active QRN fades after Reset', async () => {
    const { fetchMock } = await bootSession();
    configureValidInputs();
    selectQrn('normal');

    document.getElementById('cqButton').click();
    await settlePromiseChain();

    const firstTranscriptLength = transcript().length;
    expect(fetchMock).toHaveBeenCalledOnce();

    document.getElementById('resetButton').click();
    document.getElementById('cqButton').click();
    await settlePromiseChain();

    expect(transcript()).toHaveLength(firstTranscriptLength + 2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('re-enables QRN after selecting Off during an active session', async () => {
    const { fetchMock } = await bootSession();
    configureValidInputs();
    selectQrn('normal');

    document.getElementById('cqButton').click();
    await settlePromiseChain();

    expect(fetchMock).toHaveBeenCalledOnce();

    selectQrn('off');
    await settlePromiseChain();

    expect(fetchMock).toHaveBeenCalledOnce();

    selectQrn('heavy');
    await settlePromiseChain();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('applies enabled cut numbers to scheduled contest exchanges', async () => {
    const { releaseAudio } = await bootSession();
    configureValidInputs();
    selectMode('contest');

    const enableCutNumbers = document.getElementById('enableCutNumbers');
    enableCutNumbers.checked = true;
    enableCutNumbers.dispatchEvent(new Event('change', { bubbles: true }));
    ['cutT', 'cutA', 'cutU', 'cutV', 'cutE', 'cutG', 'cutD', 'cutN'].forEach(
      (id) => {
        document.getElementById(id).checked = ['cutT', 'cutA', 'cutE'].includes(
          id
        );
      }
    );

    document.getElementById('cqButton').click();
    releaseAudio();
    sendResponse('K0A');

    expect(transcript()).toEqual([
      ['N0ME', 'CQ TEST DE N0ME'],
      ['K0A', 'K0A'],
      ['N0ME', 'K0A'],
      ['N0ME', ' ENN'],
      ['K0A', 'ENN TA TU'],
    ]);
    expect(audioProbe.messages[3].start).toBe(audioProbe.messages[2].end);
    expect(audioProbe.messages[4].start).toBe(audioProbe.messages[3].end + 0.5);
  });

  it('renders incorrect string and numeric copied fields with expected values', async () => {
    const { random, releaseAudio } = await bootSession();
    startSession('cwt');
    releaseAudio();
    sendResponse('K0A');
    releaseAudio();

    random.mockReturnValue(0.9);
    document.getElementById('infoField').value = 'Bob';
    document.getElementById('infoField2').value = '999';
    document.getElementById('tuButton').click();

    const result = resultsRows()[0].cells[5];
    expect(result).toHaveTextContent('BOB (ADAM) / 999 (1)');
    expect(result.querySelectorAll('.text-warning')).toHaveLength(2);
    expect(result.querySelectorAll('.text-success')).toHaveLength(0);
  });

  it.each([
    {
      arrival: true,
      expectedActiveStations: '1',
      label: 'the largest representable value below 0.4',
      randomValue: 0.39999999999999997,
    },
    {
      arrival: false,
      expectedActiveStations: '0',
      label: 'exactly 0.4',
      randomValue: 0.4,
    },
  ])(
    'applies the strict post-TU arrival threshold at $label',
    async ({ arrival, expectedActiveStations, randomValue }) => {
      const { random, releaseAudio } = await bootSession();
      startSession('contest');
      releaseAudio();
      sendResponse('K0A');
      releaseAudio();

      random.mockReturnValueOnce(randomValue).mockReturnValue(0);
      document.getElementById('infoField').value = '01';
      document.getElementById('tuButton').click();

      const expectedTranscript = [
        ['N0ME', 'CQ TEST DE N0ME'],
        ['K0A', 'K0A'],
        ['N0ME', 'K0A'],
        ['N0ME', ' 5NN'],
        ['K0A', '5NN 01 TU'],
        ['N0ME', 'TU N0ME'],
      ];
      if (arrival) {
        expectedTranscript.push(['K0A', 'K0A']);
      }

      expect(transcript()).toEqual(expectedTranscript);
      expect(resultsRows()).toHaveLength(1);
      expect(document.getElementById('activeStations')).toHaveTextContent(
        expectedActiveStations
      );
      expect(document.getElementById('responseField')).toHaveValue('');
      if (arrival) {
        expect(audioProbe.messages.at(-1).start).toBe(
          audioProbe.messages.at(-2).end
        );
      }
    }
  );

  it('Reset clears a running Single session and its results', async () => {
    const { releaseAudio } = await bootSession();
    configureValidInputs();

    document.getElementById('cqButton').click();
    releaseAudio();
    document.getElementById('responseField').value = 'K0A';
    document.getElementById('sendButton').click();

    expect(resultsRows()).toHaveLength(1);
    expect(document.getElementById('activeStations')).toHaveTextContent('1');
    expect(document.getElementById('cqButton')).toBeDisabled();

    document.getElementById('responseField').value = 'stale call';
    document.getElementById('infoField').value = 'stale info';
    document.getElementById('infoField2').value = 'stale info 2';
    const contextBeforeReset = RecordingAudioContext.instances.at(-1);
    const contextCountBeforeReset = RecordingAudioContext.instances.length;

    document.getElementById('resetButton').click();

    expect(resultsRows()).toHaveLength(0);
    expect(document.getElementById('activeStations')).toHaveTextContent('0');
    expect(document.getElementById('responseField')).toHaveValue('');
    expect(document.getElementById('infoField')).toHaveValue('');
    expect(document.getElementById('infoField2')).toHaveValue('');
    expect(document.getElementById('cqButton')).toBeEnabled();
    expect(document.activeElement).toBe(
      document.getElementById('responseField')
    );
    expect(contextBeforeReset.closed).toBe(true);
    expect(RecordingAudioContext.instances).toHaveLength(
      contextCountBeforeReset + 1
    );
  });
});
