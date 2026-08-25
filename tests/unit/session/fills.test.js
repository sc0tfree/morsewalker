import { describe, expect, it } from 'vitest';

import {
  buildFillRequest,
  buildFillResponse,
  isFillCandidate,
  resolveFill,
  selectFillComponents,
} from '../../../src/js/session/fills.js';

const components = [
  {
    id: 'name',
    inputId: 'infoField',
    request: 'NAME?',
    reply: (station) => station.name,
  },
  {
    id: 'state',
    inputId: 'infoField2',
    request: 'STATE?',
    reply: (station) => station.state,
  },
];

const station = {
  name: 'ALICE',
  state: 'AK',
};

describe('fill field qualification', () => {
  it.each(['', '   ', 'AGN', 'agn', ' AGN ', '?', 'AGN?', 'WILL?', 'A?K'])(
    'qualifies %j for a fill',
    (value) => {
      expect(isFillCandidate(value)).toBe(true);
    }
  );

  it.each(['AK', 'ALICE', 'AGAIN', 'AGN NOW', 123])(
    'does not qualify %j for a fill',
    (value) => {
      expect(isFillCandidate(value)).toBe(false);
    }
  );

  it('selects eligible components in mode order', () => {
    expect(
      selectFillComponents(components, {
        infoField: 'ALICE',
        infoField2: '',
      })
    ).toEqual([components[1]]);
  });
});

describe('fill request composition', () => {
  it('uses the canonical request for a one-field mode', () => {
    expect(buildFillRequest([components[0]], [components[0]])).toBe('NAME?');
  });

  it('uses the canonical request for one missing field in a multi-field mode', () => {
    expect(buildFillRequest([components[1]], components)).toBe('STATE?');
  });

  it('uses AGN? when every field in a multi-field mode is missing', () => {
    expect(buildFillRequest(components, components)).toBe('AGN?');
  });

  it('joins an ordered proper subset of a larger exchange', () => {
    const section = {
      id: 'section',
      inputId: 'infoField3',
      request: 'SEC?',
      reply: (callingStation) => callingStation.section,
    };

    expect(
      buildFillRequest([components[0], section], [...components, section])
    ).toBe('NAME? SEC?');
  });

  it('returns no request when no fields are missing', () => {
    expect(buildFillRequest([], components)).toBe('');
  });
});

describe('fill resolution', () => {
  it('builds a component-only response in mode order', () => {
    expect(buildFillResponse(components, station)).toBe('ALICE AK');
  });

  it('uses each component reply formatter', () => {
    const repeatedState = {
      ...components[1],
      reply: (callingStation) =>
        `${callingStation.state} ${callingStation.state}`,
    };

    expect(buildFillResponse([repeatedState], station)).toBe('AK AK');
  });

  it('resolves one missing component without unrelated data', () => {
    expect(
      resolveFill(
        components,
        {
          infoField: 'ALICE',
          infoField2: '?',
        },
        station
      )
    ).toEqual({
      components: [components[1]],
      request: 'STATE?',
      response: 'AK',
    });
  });

  it('resolves all missing components with one AGN? request', () => {
    expect(
      resolveFill(
        components,
        {
          infoField: '',
          infoField2: 'AGN',
        },
        station
      )
    ).toEqual({
      components,
      request: 'AGN?',
      response: 'ALICE AK',
    });
  });

  it('returns null when no component requests a fill', () => {
    expect(
      resolveFill(
        components,
        {
          infoField: 'ALICE',
          infoField2: 'AK',
        },
        station
      )
    ).toBeNull();
  });
});
