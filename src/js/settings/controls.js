import { clearFieldInvalid } from './validation.js';

// Add event listeners to clear invalid states when user types
document.querySelectorAll('input, select, textarea').forEach((el) => {
  el.addEventListener('input', () => {
    clearFieldInvalid(el.id);
  });
});

const toggleControls = [
  {
    controlId: 'enableFarnsworth',
    dependentIds: ['farnsworthSpeed'],
    labelId: 'enableFarnsworthLabel',
    labelText: 'Farnsworth',
  },
  {
    controlId: 'usOnly',
    dependentIds: [],
    labelId: 'usOnlyLabel',
    labelText: 'US Only Callsigns',
  },
  {
    controlId: 'enableCutNumbers',
    dependentIds: [
      'cutT',
      'cutA',
      'cutU',
      'cutV',
      'cutE',
      'cutG',
      'cutD',
      'cutN',
    ],
    labelId: 'enableCutNumbersLabel',
    labelText: 'Enable Cut Numbers',
  },
  {
    controlId: 'qsb',
    dependentIds: ['qsbPercentage'],
    labelId: 'qsbLabel',
    labelText: 'QSB (Fading)',
  },
];

const defaultsModalCopy = {
  respondingStation: {
    description: 'Only Responding Station settings will be reset.',
    title: 'Restore Responding Station Settings to defaults?',
  },
  effects: {
    description: 'Only Effects settings will be reset.',
    title: 'Restore Effects Settings to defaults?',
  },
};

/**
 * Synchronizes one toggle's icon, label, and dependent controls.
 *
 * @param {Object} config - Toggle presentation configuration.
 */
function syncToggleControl(config) {
  const control = document.getElementById(config.controlId);
  if (!control) return;

  const label = document.getElementById(config.labelId);
  if (label) {
    const iconClass = control.checked
      ? 'fa-solid fa-circle-check'
      : 'fa-regular fa-circle-xmark';
    label.innerHTML = `<i class="${iconClass} me-2"></i>${config.labelText}`;
  }

  config.dependentIds.forEach((id) => {
    const dependent = document.getElementById(id);
    if (dependent) {
      dependent.disabled = !control.checked;
    }
  });
}

/**
 * Synchronizes all settings presentation derived from form-control values.
 */
export function syncSettingsControls() {
  toggleControls.forEach(syncToggleControl);

  const qsbPercentage = document.getElementById('qsbPercentage');
  const qsbValue = document.getElementById('qsbValue');
  if (qsbPercentage && qsbValue) {
    qsbValue.textContent = `${qsbPercentage.value}%`;
  }
}

/**
 * Wires settings toggles and the shared section-defaults confirmation modal.
 *
 * @param {Object} options - Settings control callbacks.
 * @param {Function} options.onRestoreDefaults - Runs after reset confirmation.
 */
export function wireSettingsControls({ onRestoreDefaults }) {
  toggleControls.forEach(({ controlId }) => {
    document
      .getElementById(controlId)
      ?.addEventListener('change', syncSettingsControls);
  });

  document
    .getElementById('qsbPercentage')
    ?.addEventListener('input', syncSettingsControls);

  const modal = document.getElementById('settingsDefaultsModal');
  const modalTitle = document.getElementById('settingsDefaultsModalLabel');
  const modalDescription = document.getElementById(
    'settingsDefaultsModalDescription'
  );
  const confirmButton = document.getElementById('confirmSettingsDefaults');
  const triggers = document.querySelectorAll('[data-settings-defaults-group]');
  let pendingGroupId = null;

  const configureModal = (groupId) => {
    const copy = defaultsModalCopy[groupId];
    if (!copy) return;

    pendingGroupId = groupId;
    modalTitle.textContent = copy.title;
    modalDescription.textContent = copy.description;
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      configureModal(trigger.dataset.settingsDefaultsGroup);
    });
  });

  modal?.addEventListener('show.bs.modal', (event) => {
    const groupId = event.relatedTarget?.dataset.settingsDefaultsGroup;
    if (groupId) {
      configureModal(groupId);
    }
  });

  modal?.addEventListener('hidden.bs.modal', () => {
    pendingGroupId = null;
  });

  confirmButton?.addEventListener('click', () => {
    if (pendingGroupId) {
      onRestoreDefaults(pendingGroupId);
    }
  });

  syncSettingsControls();
}
