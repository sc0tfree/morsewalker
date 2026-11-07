import { resumeAllAudio } from '../audio/lifecycle.js';

/** Prepare audio during the input gesture; playback stays in click handlers. */
export function wireAudioActivation() {
  const controls = document.querySelectorAll(
    '#cqButton, #sendButton, #agnButton, #tuButton, input[name="qrn"]'
  );

  for (const control of controls) {
    const targets = [control, ...(control.labels ?? [])];
    for (const target of targets) {
      // Safari can lose activation before click. Touch/pen activation may
      // instead arrive on pointerup, so retain that route and click fallback.
      target.addEventListener('pointerdown', (event) => {
        if (
          event.isPrimary !== false &&
          event.button === 0 &&
          !control.disabled
        ) {
          resumeAllAudio();
        }
      });
      target.addEventListener('pointerup', (event) => {
        if (
          event.isPrimary !== false &&
          event.pointerType !== 'mouse' &&
          event.button === 0 &&
          !control.disabled
        ) {
          resumeAllAudio();
        }
      });
      target.addEventListener('keydown', (event) => {
        const isActivationKey = event.key === 'Enter' || event.key === ' ';
        const isRadioArrow =
          control.type === 'radio' && event.key.startsWith('Arrow');
        if (isActivationKey || isRadioArrow) resumeAllAudio();
      });
      target.addEventListener('click', resumeAllAudio);
    }
  }

  for (const field of document.querySelectorAll(
    '#responseField, #infoField, #infoField2'
  )) {
    field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') resumeAllAudio();
    });
  }
}
