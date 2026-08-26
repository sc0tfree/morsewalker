/* @vitest-environment jsdom */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

let modeLogicConfig;
let modeUIConfig;

async function loadAppHtml() {
  const html = await readFile(resolve(process.cwd(), 'src/index.html'), 'utf8');
  document.open();
  document.write(html);
  document.close();
}

beforeAll(async () => {
  await loadAppHtml();
  ({ modeLogicConfig, modeUIConfig } = await import(
    '../../../src/js/modes.js'
  ));
});

const uiContracts = {
  single: {
    showTuButton: false,
    showAgnButton: false,
    showInfoField: false,
    infoFieldPlaceholder: '',
    showInfoField2: false,
    infoField2Placeholder: '',
    tableExtraColumn: false,
    extraColumnHeader: '',
    resultsHeader: 'Single Mode Results',
  },
  contest: {
    showTuButton: true,
    showAgnButton: true,
    showInfoField: true,
    infoFieldPlaceholder: 'Serial Number',
    showInfoField2: false,
    infoField2Placeholder: '',
    tableExtraColumn: true,
    extraColumnHeader: 'Serial Number',
    resultsHeader: 'Contest Mode Results',
  },
  fd: {
    showTuButton: true,
    showAgnButton: true,
    showInfoField: true,
    infoFieldPlaceholder: 'Class',
    showInfoField2: true,
    infoField2Placeholder: 'Section',
    tableExtraColumn: true,
    extraColumnHeader: 'Exchange',
    resultsHeader: 'Field Day Mode Results',
  },
  pota: {
    showTuButton: true,
    showAgnButton: true,
    showInfoField: true,
    infoFieldPlaceholder: 'State',
    showInfoField2: false,
    infoField2Placeholder: '',
    tableExtraColumn: true,
    extraColumnHeader: 'State',
    resultsHeader: 'POTA Mode Results',
  },
  sst: {
    showTuButton: true,
    showAgnButton: true,
    showInfoField: true,
    infoFieldPlaceholder: 'Name',
    showInfoField2: true,
    infoField2Placeholder: 'State',
    tableExtraColumn: true,
    extraColumnHeader: 'Additional Info',
    resultsHeader: 'SST Mode Results',
  },
  cwt: {
    showTuButton: true,
    showAgnButton: true,
    showInfoField: true,
    infoFieldPlaceholder: 'Name',
    showInfoField2: true,
    infoField2Placeholder: 'CW Ops No.',
    tableExtraColumn: true,
    extraColumnHeader: 'Additional Info',
    resultsHeader: 'CWT Mode Results',
  },
};

const logicContracts = {
  single: {
    messages: {
      cqMessage: 'CQ DE W6NYC K',
      yourExchange: '5NN',
      theirExchange: 'R 5NN TU',
      yourSignoff: 'TU EE',
      theirSignoff: 'EE',
    },
    metadata: {
      exchangeComponents: [],
      requiresInfoField: false,
      requiresInfoField2: false,
      showTuStep: false,
      modeName: 'Single',
      extraInfoFieldKey: null,
      extraInfoFieldKey2: null,
    },
  },
  contest: {
    messages: {
      cqMessage: 'CQ TEST DE W6NYC',
      yourExchange: '5NN',
      theirExchange: '5NN 07 TU',
      yourSignoff: 'TU W6NYC',
      theirSignoff: null,
    },
    metadata: {
      exchangeComponents: [
        {
          id: 'serialNumber',
          inputId: 'infoField',
          fieldKey: 'serialNumber',
          request: 'NR?',
          reply: '07',
        },
      ],
      requiresInfoField: true,
      requiresInfoField2: false,
      showTuStep: true,
      modeName: 'Contest',
      extraInfoFieldKey: 'serialNumber',
      extraInfoFieldKey2: null,
    },
  },
  fd: {
    messages: {
      cqMessage: 'CQ FD W6NYC',
      yourExchange: 'TU 2A EWA',
      theirExchange: 'R 1D EB',
      yourSignoff: 'TU W6NYC FD',
      theirSignoff: null,
    },
    metadata: {
      exchangeComponents: [
        {
          id: 'fieldDayClass',
          inputId: 'infoField',
          fieldKey: 'fieldDayClass',
          request: 'CL?',
          reply: '1D',
        },
        {
          id: 'fieldDaySection',
          inputId: 'infoField2',
          fieldKey: 'fieldDaySection',
          request: 'SEC?',
          reply: 'EB',
        },
      ],
      requiresInfoField: true,
      requiresInfoField2: true,
      showTuStep: true,
      modeName: 'Field Day',
      extraInfoFieldKey: 'fieldDayClass',
      extraInfoFieldKey2: 'fieldDaySection',
    },
  },
  pota: {
    messages: {
      cqMessage: 'CQ POTA DE W6NYC',
      yourExchange: 'UR 5NN <BK>',
      theirExchange: '<BK> UR 5NN TX TX <BK>',
      yourSignoff: '<BK> TU K1ABC 73 EE',
      theirSignoff: 'EE',
    },
    metadata: {
      exchangeComponents: [
        {
          id: 'state',
          inputId: 'infoField',
          fieldKey: 'state',
          request: 'STATE?',
          reply: 'TX TX',
        },
      ],
      requiresInfoField: true,
      requiresInfoField2: false,
      showTuStep: true,
      modeName: 'POTA',
      extraInfoFieldKey: 'state',
      extraInfoFieldKey2: null,
    },
  },
  sst: {
    messages: {
      cqMessage: 'CQ SST W6NYC',
      yourExchange: 'Henry CA',
      theirExchange: 'TU Henry Alice TX',
      yourSignoff: 'GL K1ABC TU W6NYC SST',
      theirSignoff: null,
    },
    metadata: {
      exchangeComponents: [
        {
          id: 'name',
          inputId: 'infoField',
          fieldKey: 'name',
          request: 'NAME?',
          reply: 'Alice',
        },
        {
          id: 'state',
          inputId: 'infoField2',
          fieldKey: 'state',
          request: 'STATE?',
          reply: 'TX',
        },
      ],
      requiresInfoField: true,
      requiresInfoField2: true,
      showTuStep: true,
      modeName: 'SST',
      extraInfoFieldKey: 'name',
      extraInfoFieldKey2: 'state',
    },
  },
  cwt: {
    messages: {
      cqMessage: 'CQ CWT W6NYC',
      yourExchange: 'Henry CWA',
      theirExchange: 'Alice 2468 TU',
      yourSignoff: 'TU W6NYC',
      theirSignoff: null,
    },
    metadata: {
      exchangeComponents: [
        {
          id: 'name',
          inputId: 'infoField',
          fieldKey: 'name',
          request: 'NAME?',
          reply: 'Alice',
        },
        {
          id: 'cwopsNumber',
          inputId: 'infoField2',
          fieldKey: 'cwopsNumber',
          request: 'NR?',
          reply: '2468',
        },
      ],
      requiresInfoField: true,
      requiresInfoField2: true,
      showTuStep: true,
      modeName: 'CWT',
      extraInfoFieldKey: 'name',
      extraInfoFieldKey2: 'cwopsNumber',
    },
  },
};

const yourStation = {
  callsign: 'W6NYC',
  fieldDayClass: '2A',
  fieldDaySection: 'EWA',
  name: 'Henry',
  state: 'CA',
};

const theirStation = {
  callsign: 'K1ABC',
  name: 'Alice',
  state: 'TX',
  serialNumber: '07',
  cwopsNumber: 2468,
  fieldDayClass: '1D',
  fieldDaySection: 'EB',
};

describe('mode contracts', () => {
  it('exports UI and logic contracts for exactly the six v1 modes', () => {
    const expectedModes = ['contest', 'cwt', 'fd', 'pota', 'single', 'sst'];

    expect(Object.keys(modeUIConfig).sort()).toEqual(expectedModes);
    expect(Object.keys(modeLogicConfig).sort()).toEqual(expectedModes);
  });

  it.each(Object.entries(uiContracts))(
    '%s preserves its exact UI contract',
    (mode, expected) => {
      expect(modeUIConfig[mode]).toEqual(expected);
    }
  );

  it.each(Object.entries(logicContracts))(
    '%s preserves its exact messages and exchange metadata',
    (mode, expected) => {
      const logic = modeLogicConfig[mode];

      expect({
        cqMessage: logic.cqMessage(yourStation, theirStation, 'K1ABC'),
        yourExchange: logic.yourExchange(yourStation, theirStation, 'K1ABC'),
        theirExchange: logic.theirExchange(yourStation, theirStation, 'K1ABC'),
        yourSignoff: logic.yourSignoff(yourStation, theirStation, 'K1ABC'),
        theirSignoff:
          typeof logic.theirSignoff === 'function'
            ? logic.theirSignoff(yourStation, theirStation, 'K1ABC')
            : null,
      }).toEqual(expected.messages);

      expect({
        exchangeComponents: logic.exchangeComponents.map(
          ({ id, inputId, fieldKey, request, reply }) => ({
            id,
            inputId,
            fieldKey,
            request,
            reply: reply(theirStation),
          })
        ),
        requiresInfoField: logic.requiresInfoField,
        requiresInfoField2: logic.requiresInfoField2,
        showTuStep: logic.showTuStep,
        modeName: logic.modeName,
        extraInfoFieldKey: logic.extraInfoFieldKey,
        extraInfoFieldKey2: logic.extraInfoFieldKey2,
      }).toEqual(expected.metadata);
    }
  );
});
