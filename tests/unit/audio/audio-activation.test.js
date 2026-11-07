// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  installRecordingAudioContext,
  RecordingAudioContext,
} from '../../helpers/audioContext.js';
import { loadAudioTestPage } from './test-page.js';

function pointerEvent(type, overrides = {}) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, {
    button: 0,
    isPrimary: true,
    pointerType: 'mouse',
    ...overrides,
  });
  return event;
}

async function settlePromiseChain() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe('audio activation', () => {
  let audio;
  let resumeAllAudio;
  let wireAudioActivation;
  let contexts;
  let resumes;
  let fetchMock;

  beforeEach(async () => {
    vi.resetModules();
    await loadAudioTestPage();
    installRecordingAudioContext();
    audio = await import('../../../src/js/audio.js');
    ({ resumeAllAudio } = await import('../../../src/js/audio/lifecycle.js'));
    ({ wireAudioActivation } = await import(
      '../../../src/js/session/audio-activation.js'
    ));
    contexts = RecordingAudioContext.instances;
    resumes = contexts.map((context) => {
      context.state = 'suspended';
      return vi.spyOn(context, 'resume');
    });
    fetchMock = vi.fn().mockResolvedValue({
      arrayBuffer: async () => new ArrayBuffer(4),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function suspendAgain() {
    contexts.forEach((context) => {
      context.state = 'suspended';
    });
    resumes.forEach((resume) => resume.mockClear());
  }

  function expectResumedOnce() {
    for (const resume of resumes) expect(resume).toHaveBeenCalledOnce();
    expect(contexts.map((context) => context.state)).toEqual([
      'running',
      'running',
    ]);
  }

  it.each([0, 1])(
    'resumes the other context independently when context %i rejects, then retries',
    async (failedIndex) => {
      const error = new Error('Audio activation blocked');
      resumes[failedIndex].mockRejectedValueOnce(error);

      resumeAllAudio();

      for (const resume of resumes) expect(resume).toHaveBeenCalledOnce();
      expect(contexts[1 - failedIndex].state).toBe('running');
      await settlePromiseChain();
      expect(console.error).toHaveBeenCalledWith(
        'Error resuming audio:',
        error
      );

      resumeAllAudio();
      await settlePromiseChain();

      expect(resumes[failedIndex]).toHaveBeenCalledTimes(2);
      expect(resumes[1 - failedIndex]).toHaveBeenCalledOnce();
      expect(contexts.map((context) => context.state)).toEqual([
        'running',
        'running',
      ]);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(audio.isBackgroundStaticPlaying()).toBe(false);
    }
  );

  it('cannot start pending static when activation completes after a reset', async () => {
    let resolveResume;
    const pendingResume = new Promise((resolve) => {
      resolveResume = resolve;
    });
    resumes.forEach((resume) => resume.mockReturnValue(pendingResume));

    resumeAllAudio();
    audio.createBackgroundStatic();
    audio.stopAllAudio();
    resolveResume();
    await settlePromiseChain();

    expect(contexts[0].state).toBe('closed');
    expect(contexts[1].bufferSources).toHaveLength(0);
    expect(audio.audioContext).not.toBe(contexts[0]);
    expect(audio.isBackgroundStaticPlaying()).toBe(false);
  });

  it('unlocks action controls and QRN labels on press, touch/pen release, or click fallback without starting audio', () => {
    wireAudioActivation();
    const controls = document.querySelectorAll(
      '#cqButton, #sendButton, #agnButton, #tuButton, input[name="qrn"]'
    );

    for (const control of controls) {
      control.disabled = false;
      for (const target of [control, ...(control.labels ?? [])]) {
        const activations = [
          () => target.dispatchEvent(pointerEvent('pointerdown')),
          () =>
            target.dispatchEvent(
              pointerEvent('pointerup', { pointerType: 'touch' })
            ),
          () =>
            target.dispatchEvent(
              pointerEvent('pointerup', { pointerType: 'pen' })
            ),
          () => target.click(),
        ];
        for (const activate of activations) {
          suspendAgain();
          activate();
          expectResumedOnce();
        }
      }
    }

    expect(fetchMock).not.toHaveBeenCalled();
    expect(contexts.flatMap((context) => context.bufferSources)).toEqual([]);
    expect(contexts.flatMap((context) => context.oscillators)).toEqual([]);
    expect(audio.isBackgroundStaticPlaying()).toBe(false);
  });

  it('unlocks buttons with Enter/Space, QRN with arrows, and response fields with Enter', () => {
    wireAudioActivation();
    const controls = document.querySelectorAll(
      '#cqButton, #sendButton, #agnButton, #tuButton, input[name="qrn"]'
    );

    for (const control of controls) {
      control.disabled = false;
      const keys = ['Enter', ' '];
      if (control.type === 'radio') {
        keys.push('ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight');
      }
      for (const key of keys) {
        suspendAgain();
        control.dispatchEvent(new KeyboardEvent('keydown', { key }));
        expectResumedOnce();
      }
    }
    for (const id of ['responseField', 'infoField', 'infoField2']) {
      suspendAgain();
      document
        .getElementById(id)
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expectResumedOnce();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores secondary pointers/buttons, mouse release, disabled controls, and unrelated keys', () => {
    wireAudioActivation();
    const cqButton = document.getElementById('cqButton');

    cqButton.dispatchEvent(pointerEvent('pointerdown', { button: 2 }));
    cqButton.dispatchEvent(pointerEvent('pointerdown', { isPrimary: false }));
    cqButton.dispatchEvent(
      pointerEvent('pointerup', { isPrimary: false, pointerType: 'touch' })
    );
    cqButton.dispatchEvent(pointerEvent('pointerup'));
    cqButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    document
      .getElementById('responseField')
      .dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    document
      .getElementById('qrnNormal')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    cqButton.disabled = true;
    cqButton.dispatchEvent(pointerEvent('pointerdown'));
    cqButton.dispatchEvent(pointerEvent('pointerup', { pointerType: 'touch' }));

    for (const resume of resumes) expect(resume).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
