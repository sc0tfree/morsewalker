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

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('background static lifecycle', () => {
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

  it('fetches one track and fades it only on the background clock', async () => {
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

    audio.updateAudioLock(20);
    audio.audioContext.currentTime = 4;
    staticContext.currentTime = 12;
    audio.stopBackgroundStatic();

    expect(gain.gain.events).toEqual([
      { type: 'set', value: 1.5, time: 12 },
      { type: 'linearRamp', value: 0, time: 13 },
    ]);
    expect(audio.audioLockUntil).toBe(20);
    expect(source.stopped).toEqual([13]);
    expect(audio.isBackgroundStaticPlaying()).toBe(false);
    expect(source.disconnected).toBe(false);
    expect(gain.disconnected).toBe(false);

    source.emitEnded();

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

  it('does not start QRN when intensity changes before a session starts', async () => {
    document.getElementById('qrnHeavy').checked = true;
    const { fetchMock } = mockStaticFetch();

    audio.updateStaticIntensity();
    await settlePromiseChain();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(audio.isBackgroundStaticPlaying()).toBe(false);
  });

  it('replaces every active QRN level and can transition through Off to On', async () => {
    const { fetchMock } = mockStaticFetch();
    const staticContext = RecordingAudioContext.instances[1];

    audio.createBackgroundStatic();
    await settlePromiseChain();

    const normalSource = staticContext.bufferSources[0];
    expect(staticContext.gains[0].gain.value).toBe(0.75);

    document.getElementById('qrnModerate').checked = true;
    audio.updateStaticIntensity();
    await settlePromiseChain();

    expect(normalSource.stopped).toEqual([0]);
    expect(normalSource.disconnected).toBe(true);
    expect(staticContext.gains[1].gain.value).toBe(1.5);

    document.getElementById('qrnHeavy').checked = true;
    audio.updateStaticIntensity();
    await settlePromiseChain();

    expect(staticContext.bufferSources[1].stopped).toEqual([0]);
    expect(staticContext.gains[2].gain.value).toBe(3);

    document.getElementById('qrnOff').checked = true;
    audio.updateStaticIntensity();
    await settlePromiseChain();

    expect(staticContext.bufferSources[2].stopped).toEqual([0]);
    expect(staticContext.bufferSources[2].disconnected).toBe(true);
    expect(audio.isBackgroundStaticPlaying()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    document.getElementById('qrnNormal').checked = true;
    audio.updateStaticIntensity();
    await settlePromiseChain();

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(staticContext.bufferSources).toHaveLength(4);
    expect(staticContext.gains[3].gain.value).toBe(0.75);
    expect(audio.isBackgroundStaticPlaying()).toBe(true);
  });

  it('invalidates a duplicate pending load before it can decode or start', async () => {
    const pendingArrayBuffer = createDeferred();
    const response = {
      arrayBuffer: vi.fn(() => pendingArrayBuffer.promise),
    };
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);
    const staticContext = RecordingAudioContext.instances[1];
    const decode = vi.spyOn(staticContext, 'decodeAudioData');

    audio.createBackgroundStatic();
    audio.createBackgroundStatic();
    await settlePromiseChain();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(response.arrayBuffer).toHaveBeenCalledOnce();
    expect(audio.isBackgroundStaticPlaying()).toBe(true);

    audio.stopBackgroundStatic(true);
    expect(audio.isBackgroundStaticPlaying()).toBe(false);

    pendingArrayBuffer.resolve(new ArrayBuffer(4));
    await settlePromiseChain();

    expect(decode).not.toHaveBeenCalled();
    expect(staticContext.bufferSources).toHaveLength(0);
  });

  it('keeps an immediate replacement independent from retiring cleanup', async () => {
    const { fetchMock } = mockStaticFetch();
    const staticContext = RecordingAudioContext.instances[1];

    audio.createBackgroundStatic();
    await settlePromiseChain();
    const firstSource = staticContext.bufferSources[0];
    const firstGain = staticContext.gains[0];

    staticContext.currentTime = 12;
    audio.stopBackgroundStatic();
    audio.createBackgroundStatic();
    await settlePromiseChain();

    const secondSource = staticContext.bufferSources[1];
    const secondGain = staticContext.gains[1];
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(firstSource.stopped).toEqual([13]);
    expect(secondSource.started).toEqual([13]);
    expect(audio.isBackgroundStaticPlaying()).toBe(true);

    firstSource.emitEnded();

    expect(firstSource.disconnected).toBe(true);
    expect(firstGain.disconnected).toBe(true);
    expect(secondSource.disconnected).toBe(false);
    expect(secondGain.disconnected).toBe(false);
    expect(audio.isBackgroundStaticPlaying()).toBe(true);
  });

  it('leaves the replacement foreground context unlocked while QRN fades', async () => {
    mockStaticFetch();
    audio.createBackgroundStatic();
    await settlePromiseChain();
    const firstContext = audio.audioContext;
    const staticSource = RecordingAudioContext.instances[1].bufferSources[0];

    audio.updateAudioLock(20);
    audio.stopAllAudio();

    expect(firstContext.closed).toBe(true);
    expect(audio.audioContext).toBe(RecordingAudioContext.instances[2]);
    expect(audio.audioLockUntil).toBe(0);
    expect(audio.getAudioLock()).toBe(false);
    expect(staticSource.stopped).toEqual([1]);
    expect(audio.isBackgroundStaticPlaying()).toBe(false);
  });
});
