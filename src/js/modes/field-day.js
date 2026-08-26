import {
  isValidFieldDayClass,
  isValidFieldDaySection,
} from '../stations/fieldDayData.js';

/**
 * ARRL Field Day mode: a pileup where each station sends its operating class
 * and ARRL/RAC section (or DX).
 *
 * See `./index.js` for the descriptor shape shared by every mode.
 */
export default {
  id: 'fd',
  label: 'Field Day',
  ui: {
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
  logic: {
    cqMessage: (yourStation, theirStation, arbitrary) =>
      `CQ FD ${yourStation.callsign}`,
    yourExchange: (yourStation, theirStation, arbitrary) =>
      `TU ${yourStation.fieldDayClass} ${yourStation.fieldDaySection}`,
    theirExchange: (yourStation, theirStation, arbitrary) =>
      `R ${theirStation.fieldDayClass} ${theirStation.fieldDaySection}`,
    yourSignoff: (yourStation, theirStation, arbitrary) =>
      `TU ${yourStation.callsign} FD`,
    theirSignoff: null,
    signoffArg: () => null,
    exchangeComponents: [
      {
        id: 'fieldDayClass',
        inputId: 'infoField',
        fieldKey: 'fieldDayClass',
        request: 'CL?',
        reply: (station) => station.fieldDayClass,
      },
      {
        id: 'fieldDaySection',
        inputId: 'infoField2',
        fieldKey: 'fieldDaySection',
        request: 'SEC?',
        reply: (station) => station.fieldDaySection,
      },
    ],
    requiresInfoField: true,
    requiresInfoField2: true,
    showTuStep: true,
    modeName: 'Field Day',
    extraInfoFieldKey: 'fieldDayClass',
    extraInfoFieldKey2: 'fieldDaySection',
  },
  requiredOperatorFields: [
    {
      id: 'yourFieldDayClass',
      message: 'Your Field Day class is required for Field Day mode.',
      invalidMessage: 'Use a valid Field Day class, such as 1D or 3A.',
      validate: isValidFieldDayClass,
    },
    {
      id: 'yourFieldDaySection',
      message: 'Your ARRL/RAC section is required for Field Day mode.',
      invalidMessage: 'Use a current ARRL/RAC section abbreviation or DX.',
      validate: isValidFieldDaySection,
    },
  ],
};
