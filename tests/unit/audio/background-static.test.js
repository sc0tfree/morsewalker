// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  installRecordingAudioContext,
  RecordingAudioContext,
} from '../../helpers/audioContext.js';
import { loadAudioTestPage } from './test-page.js';

const AUDIO_MODULE = '../../../src/js/audio.js';

async function settlePromiseChain() {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

describe('background static v1 characterization', () => {
  let audio;

  beforeEach(async () => {
    vi.resetModules();
    await loadAudioTestPage();
    document.getElementById('yourCallsign').value = 'W6NYC';
    installRecordingAudioContext();
    audio = await import(AUDIO_MODULE);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function mockStaticFetch(arrayBuffer = new ArrayBuffer(4)) {
    const response = {
      arrayBuffer: vi.fn().mockResolvedValue(arrayBuffer),
    };
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);
    return { arrayBuffer, fetchMock, response };
  }

  it('fetches, loops, fades, and disconnects representative moderate QRN', async () => {
    vi.useFakeTimers();
    document.getElementById('qrnModerate').checked = true;
    const { arrayBuffer, fetchMock, response } = mockStaticFetch();
    const staticContext = RecordingAudioContext.instances[1];
    const decode = vi.spyOn(staticContext, 'decodeAudioData');

    audio.createBackgroundStatic();
    await settlePromiseChain();

    const [source] = staticContext.bufferSources;
    const [gain] = staticContext.gains;
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('../audio/static.mp3');
    expect(response.arrayBuffer).toHaveBeenCalledOnce();
    expect(decode).toHaveBeenCalledWith(arrayBuffer);
    expect(source.buffer).toEqual({ arrayBuffer });
    expect(source.loop).toBe(true);
    expect(source.connections).toEqual([gain]);
    expect(source.started).toEqual([undefined]);
    expect(gain.gain.value).toBe(1.5);
    expect(gain.connections).toEqual([staticContext.destination]);
    expect(audio.isBackgroundStaticPlaying()).toBe(true);

    audio.createBackgroundStatic();
    expect(fetchMock).toHaveBeenCalledOnce();

    audio.audioContext.currentTime = 4;
    staticContext.currentTime = 12;
    audio.stopBackgroundStatic();

    expect(gain.gain.events).toEqual([
      { type: 'set', value: 1.5, time: 12 },
      { type: 'linearRamp', value: 0, time: 13 },
    ]);
    expect(audio.audioLockUntil).toBe(5);
    expect(source.stopped).toEqual([]);
    expect(audio.isBackgroundStaticPlaying()).toBe(true);

    vi.advanceTimersByTime(999);
    expect(source.stopped).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(source.stopped).toEqual([undefined]);
    expect(source.disconnected).toBe(true);
    expect(gain.disconnected).toBe(true);
    expect(audio.isBackgroundStaticPlaying()).toBe(false);
  });

  it('does not fetch or start QRN when the selected level is off', async () => {
    document.getElementById('qrnOff').checked = true;
    const { fetchMock } = mockStaticFetch();

    audio.createBackgroundStatic();
    await settlePromiseChain();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(RecordingAudioContext.instances[1].bufferSources).toHaveLength(0);
    expect(audio.isBackgroundStaticPlaying()).toBe(false);
  });

  it('currently leaves the replacement context locked while active QRN fades', async () => {
    vi.useFakeTimers();
    mockStaticFetch();
    audio.createBackgroundStatic();
    await settlePromiseChain();
    const firstContext = audio.audioContext;

    audio.updateAudioLock(20);
    audio.stopAllAudio();

    expect(firstContext.closed).toBe(true);
    expect(audio.audioContext).toBe(RecordingAudioContext.instances[2]);
    expect(audio.audioLockUntil).toBe(1);
    expect(audio.getAudioLock()).toBe(true);
    expect(audio.isBackgroundStaticPlaying()).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(audio.isBackgroundStaticPlaying()).toBe(false);
  });
});
