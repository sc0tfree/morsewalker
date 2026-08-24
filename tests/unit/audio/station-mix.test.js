import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installRecordingAudioContext } from '../../helpers/audioContext.js';
import { createSequenceRandom } from '../../helpers/random.js';
import { buildStation } from '../../helpers/stations.js';

const AUDIO_MODULE = '../../../src/js/audio.js';
const INPUTS_MODULE = '../../../src/js/inputs.js';
const RUNTIME_MODULE = '../../../src/js/audio/runtime.js';
const STATION_MIX_MODULE = '../../../src/js/audio/stationMix.js';

describe('station mix v1 characterization', () => {
  let createMorsePlayer;
  let getInputs;
  let runtime;
  let stationMix;
  let updateAudioLock;

  beforeEach(async () => {
    vi.resetModules();
    installRecordingAudioContext();
    runtime = await import(RUNTIME_MODULE);

    createMorsePlayer = vi.fn((station, adjustedVolume) => ({
      adjustedVolume,
      callsign: station.callsign,
      playSentence: vi.fn((_sentence, startTime) => startTime),
    }));
    updateAudioLock = vi.fn((time) => runtime.updateAudioLock(time));
    getInputs = vi.fn(() => ({ minWait: 0.25, maxWait: 2 }));

    vi.doMock(AUDIO_MODULE, () => ({
      createMorsePlayer,
      updateAudioLock,
    }));
    vi.doMock(INPUTS_MODULE, () => ({ getInputs }));

    stationMix = await import(STATION_MIX_MODULE);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.doUnmock(AUDIO_MODULE);
    vi.doUnmock(INPUTS_MODULE);
    vi.restoreAllMocks();
  });

  function arrangePlayers(endTimes) {
    const players = endTimes.map((endTime) => ({
      playSentence: vi.fn().mockReturnValue(endTime),
    }));
    let playerIndex = 0;
    createMorsePlayer.mockImplementation(() => players[playerIndex++]);
    return players;
  }

  describe('normalizeStationGain', () => {
    it('passes original gains through when total gain is below one', () => {
      const stations = [
        buildStation({ callsign: 'LOW', volume: 0.2 }),
        buildStation({ callsign: 'MID', volume: 0.3 }),
      ];

      stationMix.normalizeStationGain(stations);

      expect(createMorsePlayer).toHaveBeenNthCalledWith(1, stations[0], 0.2);
      expect(createMorsePlayer).toHaveBeenNthCalledWith(2, stations[1], 0.3);
      expect(stations.map((station) => station.volume)).toEqual([0.2, 0.3]);
    });

    it('does not scale gains when total gain equals one', () => {
      const stations = [
        buildStation({ callsign: 'A', volume: 0.4 }),
        buildStation({ callsign: 'B', volume: 0.6 }),
      ];

      stationMix.normalizeStationGain(stations);

      expect(createMorsePlayer).toHaveBeenNthCalledWith(1, stations[0], 0.4);
      expect(createMorsePlayer).toHaveBeenNthCalledWith(2, stations[1], 0.6);
    });

    it('scales player gains proportionally when total gain exceeds one', () => {
      const stations = [
        buildStation({ callsign: 'A', volume: 0.6 }),
        buildStation({ callsign: 'B', volume: 0.9 }),
      ];

      stationMix.normalizeStationGain(stations);

      const adjustedGains = createMorsePlayer.mock.calls.map((call) => call[1]);
      expect(adjustedGains[0]).toBeCloseTo(0.4);
      expect(adjustedGains[1]).toBeCloseTo(0.6);
      expect(adjustedGains[0] + adjustedGains[1]).toBeCloseTo(1);
      expect(stations.map((station) => station.volume)).toEqual([0.6, 0.9]);
    });

    it('returns a new array with the same stations and replaces existing players', () => {
      const previousPlayers = [{ id: 'old-a' }, { id: 'old-b' }];
      const replacementPlayers = [{ id: 'new-a' }, { id: 'new-b' }];
      const stations = [
        buildStation({
          callsign: 'A',
          volume: 0.2,
          player: previousPlayers[0],
        }),
        buildStation({
          callsign: 'B',
          volume: 0.3,
          player: previousPlayers[1],
        }),
      ];
      createMorsePlayer
        .mockReturnValueOnce(replacementPlayers[0])
        .mockReturnValueOnce(replacementPlayers[1]);

      const result = stationMix.normalizeStationGain(stations);

      expect(result).not.toBe(stations);
      expect(result[0]).toBe(stations[0]);
      expect(result[1]).toBe(stations[1]);
      expect(result.map((station) => station.player)).toEqual(
        replacementPlayers
      );
    });

    it('returns an empty array without creating players for no stations', () => {
      const result = stationMix.normalizeStationGain([]);

      expect(result).toEqual([]);
      expect(createMorsePlayer).not.toHaveBeenCalled();
    });
  });

  describe('respondWithAllStations', () => {
    it.each([
      ['lower min and upper max', { minWait: -4, maxWait: 20 }, 0.5, 2.5],
      ['upper min', { minWait: 8, maxWait: 4 }, 0.5, 3],
    ])('clamps %s wait inputs', (_label, inputs, randomValue, delay) => {
      getInputs.mockReturnValue(inputs);
      const [player] = arrangePlayers([150]);
      vi.spyOn(Math, 'random').mockReturnValue(randomValue);
      const station = buildStation({ callsign: 'CLAMP' });

      stationMix.respondWithAllStations([station], 100);

      expect(player.playSentence).toHaveBeenCalledWith('CLAMP', 100 + delay);
    });

    it('uses the default minimum and maximum as delay boundaries', () => {
      getInputs.mockReturnValue({ minWait: 0.25, maxWait: 2 });
      const players = arrangePlayers([20, 30]);
      const sequence = createSequenceRandom([0, 1]);
      vi.spyOn(Math, 'random').mockImplementation(() => sequence.next());
      const stations = [
        buildStation({ callsign: 'ZERO', volume: 0.4 }),
        buildStation({ callsign: 'ONE', volume: 0.6 }),
      ];

      stationMix.respondWithAllStations(stations, 10);

      expect(players[0].playSentence).toHaveBeenCalledWith('ZERO', 10.25);
      expect(players[1].playSentence).toHaveBeenCalledWith('ONE', 12);
      expect(sequence.calls).toBe(2);
    });

    it('uses equal wait values as a fixed delay', () => {
      getInputs.mockReturnValue({ minWait: 1.25, maxWait: 1.25 });
      const players = arrangePlayers([20, 30, 40]);
      const sequence = createSequenceRandom([0, 0.5, 1]);
      vi.spyOn(Math, 'random').mockImplementation(() => sequence.next());
      const stations = [
        buildStation({ callsign: 'LOW' }),
        buildStation({ callsign: 'MID' }),
        buildStation({ callsign: 'HIGH' }),
      ];

      stationMix.respondWithAllStations(stations, 10);

      expect(
        players.map((player) => player.playSentence.mock.calls[0][1])
      ).toEqual([11.25, 11.25, 11.25]);
      expect(sequence.calls).toBe(3);
    });

    it('uses the minimum as a fixed delay for a reversed range', () => {
      getInputs.mockReturnValue({ minWait: 1.5, maxWait: 0.5 });
      const [player] = arrangePlayers([20]);
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      stationMix.respondWithAllStations(
        [buildStation({ callsign: 'REVERSED' })],
        10
      );

      expect(player.playSentence).toHaveBeenCalledWith('REVERSED', 11.5);
    });

    it('schedules every response relative to the supplied audio lock', () => {
      getInputs.mockReturnValue({ minWait: 0.25, maxWait: 1.25 });
      const [player] = arrangePlayers([90]);
      vi.spyOn(Math, 'random').mockReturnValue(0.75);

      stationMix.respondWithAllStations(
        [buildStation({ callsign: 'LOCKED' })],
        42
      );

      expect(player.playSentence).toHaveBeenCalledWith('LOCKED', 43);
    });

    it('retains the maximum response end time as the audio lock', () => {
      getInputs.mockReturnValue({ minWait: 0, maxWait: 0 });
      const players = arrangePlayers([30, 44, 35]);
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const stations = [
        buildStation({ callsign: 'FIRST', volume: 0.2 }),
        buildStation({ callsign: 'LONGEST', volume: 0.3 }),
        buildStation({ callsign: 'LAST', volume: 0.4 }),
      ];

      stationMix.respondWithAllStations(stations, 12);

      expect(
        players.map((player) => player.playSentence.mock.calls[0][1])
      ).toEqual([12, 12, 12]);
      expect(updateAudioLock.mock.calls).toEqual([[30], [44], [35]]);
      expect(runtime.audioLockUntil).toBe(44);
    });

    it('does not schedule or update the lock for an empty station list', () => {
      const random = vi.spyOn(Math, 'random');

      stationMix.respondWithAllStations([], 12);

      expect(getInputs).toHaveBeenCalledOnce();
      expect(random).not.toHaveBeenCalled();
      expect(createMorsePlayer).not.toHaveBeenCalled();
      expect(updateAudioLock).not.toHaveBeenCalled();
      expect(runtime.audioLockUntil).toBe(0);
    });
  });
});
