// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  installRecordingAudioContext,
  RecordingAudioContext,
} from '../../helpers/audioContext.js';
import { loadAudioTestPage } from './test-page.js';

const AUDIO_MODULE = '../../../src/js/audio.js';

describe('audio module state and lock v1 characterization', () => {
  let audio;

  beforeEach(async () => {
    vi.resetModules();
    await loadAudioTestPage();
    document.getElementById('yourCallsign').value = 'W6NYC';
    installRecordingAudioContext();
    audio = await import(AUDIO_MODULE);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes the current public audio API and its two import-time contexts', () => {
    expect(Object.keys(audio).sort()).toEqual([
      'audioContext',
      'audioLockUntil',
      'createBackgroundStatic',
      'createMorsePlayer',
      'getAudioLock',
      'isBackgroundStaticPlaying',
      'stopAllAudio',
      'stopBackgroundStatic',
      'updateAudioLock',
      'updateStaticIntensity',
    ]);
    expect(RecordingAudioContext.instances).toHaveLength(2);
    expect(audio.audioContext).toBe(RecordingAudioContext.instances[0]);
    expect(audio.audioContext).not.toBe(RecordingAudioContext.instances[1]);
    expect(audio.audioLockUntil).toBe(0);
  });

  it('keeps the lock monotonic and unlocks at the exact boundary', () => {
    audio.audioContext.currentTime = 5;

    audio.updateAudioLock(10);
    expect(audio.audioLockUntil).toBe(10);
    expect(audio.getAudioLock()).toBe(true);

    audio.updateAudioLock(8);
    expect(audio.audioLockUntil).toBe(10);

    audio.audioContext.currentTime = 9.999;
    expect(audio.getAudioLock()).toBe(true);

    audio.audioContext.currentTime = 10;
    expect(audio.getAudioLock()).toBe(false);

    audio.updateAudioLock(10);
    expect(audio.audioLockUntil).toBe(10);
  });

  it('replaces the exported context through its live binding and resets the lock', () => {
    const firstContext = audio.audioContext;
    audio.updateAudioLock(25);

    audio.stopAllAudio();

    expect(firstContext.closed).toBe(true);
    expect(audio.audioContext).toBe(RecordingAudioContext.instances[2]);
    expect(audio.audioContext).not.toBe(firstContext);
    expect(audio.audioContext.closed).toBe(false);
    expect(audio.audioLockUntil).toBe(0);
    expect(audio.getAudioLock()).toBe(false);
  });
});
