// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  installRecordingAudioContext,
  RecordingAudioContext,
} from '../../helpers/audioContext.js';
import { buildStation } from '../../helpers/stations.js';
import { loadAudioTestPage } from './test-page.js';

const AUDIO_MODULE = '../../../src/js/audio.js';

function round(value) {
  return Number(value.toFixed(6));
}

function gainTrace(context, gainIndex = 0) {
  return context.gains[gainIndex].gain.events.map((event) => ({
    ...event,
    value: round(event.value),
    time: round(event.time),
  }));
}

function symbolWindows(context, gainIndex = 0) {
  const events = context.gains[gainIndex].gain.events;
  const windows = [];

  for (let index = 0; index < events.length; index += 6) {
    windows.push({
      start: round(events[index].time),
      end: round(events[index + 4].time),
    });
  }

  return windows;
}

function expectedSchedule(code, startTime = 0, unit = 0.06) {
  let time = startTime;
  const windows = [];

  for (const symbol of code) {
    const duration = symbol === '-' ? unit * 3 : unit;
    windows.push({ start: round(time), end: round(time + duration) });
    time += duration + unit;
  }

  return {
    windows,
    endTime: round(time + unit * 2),
  };
}

describe('createMorsePlayer v1 characterization', () => {
  let audio;

  beforeEach(async () => {
    vi.resetModules();
    await loadAudioTestPage();
    document.getElementById('yourCallsign').value = 'W6NYC';
    installRecordingAudioContext();
    audio = await import(AUDIO_MODULE);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not create a player when the current form inputs are invalid', () => {
    document.getElementById('yourCallsign').value = '';

    expect(audio.createMorsePlayer(buildStation())).toBeUndefined();
    expect(audio.audioContext.oscillators).toHaveLength(0);
    expect(audio.audioContext.gains).toHaveLength(0);
  });

  it('creates and starts the station signal chain on the exported context', () => {
    const station = buildStation({ frequency: 725 });

    const player = audio.createMorsePlayer(station);
    const [oscillator] = audio.audioContext.oscillators;
    const [gain] = audio.audioContext.gains;

    expect(player.context).toBe(audio.audioContext);
    expect(oscillator.type).toBe('sine');
    expect(oscillator.frequency.value).toBe(725);
    expect(oscillator.connections).toEqual([gain]);
    expect(oscillator.started).toEqual([undefined]);
    expect(gain.gain.value).toBe(0);
    expect(gain.connections).toEqual([audio.audioContext.destination]);
  });

  it('preserves standard intra-character, letter, and word scheduling', () => {
    const player = audio.createMorsePlayer(buildStation({ wpm: 20 }));

    const endTime = player.playSentence('AE E');

    expect(symbolWindows(player.context)).toEqual([
      { start: 0, end: 0.06 },
      { start: 0.12, end: 0.3 },
      { start: 0.48, end: 0.54 },
      { start: 0.96, end: 1.02 },
    ]);
    expect(round(endTime)).toBe(1.2);
  });

  it('uses character speed for symbols and Farnsworth speed for larger gaps', () => {
    const player = audio.createMorsePlayer(
      buildStation({
        wpm: 20,
        enableFarnsworth: true,
        farnsworthSpeed: 10,
      })
    );

    const endTime = player.playSentence('AE E');

    expect(symbolWindows(player.context)).toEqual([
      { start: 0, end: 0.06 },
      { start: 0.12, end: 0.3 },
      { start: 0.66, end: 0.72 },
      { start: 1.56, end: 1.62 },
    ]);
    expect(round(endTime)).toBe(1.98);
  });

  it('falls back to station speed when Farnsworth speed is absent', () => {
    const player = audio.createMorsePlayer(
      buildStation({
        wpm: 20,
        enableFarnsworth: true,
        farnsworthSpeed: null,
      })
    );

    expect(round(player.playSentence('E E'))).toBe(0.72);
    expect(symbolWindows(player.context)).toEqual([
      { start: 0, end: 0.06 },
      { start: 0.48, end: 0.54 },
    ]);
  });

  it('records the exact six-event attack and release envelope for a dot', () => {
    const player = audio.createMorsePlayer(buildStation({ volume: 0.7 }), 0.25);

    const endTime = player.playSentence('E', 2);

    expect(gainTrace(player.context)).toEqual([
      { type: 'set', value: 0.001, time: 2 },
      { type: 'exponentialRamp', value: 0.25, time: 2.006 },
      { type: 'set', value: 0.25, time: 2.006 },
      { type: 'set', value: 0.25, time: 2.054 },
      { type: 'exponentialRamp', value: 0.001, time: 2.06 },
      { type: 'set', value: 0, time: 2.061 },
    ]);
    expect(round(endTime)).toBe(2.24);
  });

  it.each([
    ['period', '.', '.-.-.-'],
    ['comma', ',', '--..--'],
    ['question mark', '?', '..--..'],
    ['slash', '/', '-..-.'],
    ['BK prosign', '<bk>', '-...-.-'],
    ['AR prosign', '<ar>', '.-.-.'],
    ['SK prosign', '<sk>', '...-.-'],
    ['KN prosign', '<kn>', '-.--.'],
    ['BT prosign', '<bt>', '-...-'],
  ])('tokenizes and schedules the supported %s', (_label, token, code) => {
    const player = audio.createMorsePlayer(buildStation({ wpm: 20 }));
    const expected = expectedSchedule(code);

    const endTime = player.playSentence(token);

    expect(symbolWindows(player.context)).toEqual(expected.windows);
    expect(round(endTime)).toBe(expected.endTime);
  });

  it('warns for an unknown token without advancing the schedule', () => {
    const player = audio.createMorsePlayer(buildStation({ wpm: 20 }));

    const endTime = player.playSentence('E#E');

    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.warn).toHaveBeenCalledWith('Unrecognized token: #');
    expect(symbolWindows(player.context)).toEqual([
      { start: 0, end: 0.06 },
      { start: 0.24, end: 0.3 },
    ]);
    expect(round(endTime)).toBe(0.48);
  });

  it("uses each station's QSB frequency when calculating symbol gain", () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const slowPlayer = audio.createMorsePlayer(
      buildStation({
        callsign: 'SLOW',
        qsb: true,
        qsbDepth: 0.8,
        qsbFrequency: 0.25,
      })
    );
    const fastPlayer = audio.createMorsePlayer(
      buildStation({
        callsign: 'FAST',
        qsb: true,
        qsbDepth: 0.8,
        qsbFrequency: 0.75,
      })
    );

    slowPlayer.playSentence('E', 1);
    fastPlayer.playSentence('E', 1);

    const slowEvents = slowPlayer.context.gains[0].gain.events;
    const fastEvents = fastPlayer.context.gains[1].gain.events;
    const slowPeak = slowEvents[1].value;
    const fastPeak = fastEvents[1].value;

    expect(random).toHaveBeenCalledTimes(2);
    expect(slowEvents.slice(1, 4).map(({ value }) => value)).toEqual([
      slowPeak,
      slowPeak,
      slowPeak,
    ]);
    expect(fastEvents.slice(1, 4).map(({ value }) => value)).toEqual([
      fastPeak,
      fastPeak,
      fastPeak,
    ]);
    expect(slowPeak).toBeCloseTo(0.140012435609, 10);
    expect(fastPeak).toBeCloseTo(0.699888086142, 10);
    expect(RecordingAudioContext.instances).toHaveLength(2);
  });
});
