import { expect, test } from '@playwright/test';

import {
  audioSnapshot,
  configureValidInputs,
  installTestEnvironment,
  openApp,
  releaseAudio,
  selectMode,
  setRandom,
} from './helpers.js';

const modeJourneys = [
  {
    activeAfterCompletion: '1',
    extra: null,
    header: 'Single Mode Results',
    label: 'Single',
    mode: 'single',
  },
  {
    activeAfterCompletion: '0',
    extra: '1',
    header: 'Contest Mode Results',
    info1: '01',
    label: 'Contest',
    mode: 'contest',
  },
  {
    activeAfterCompletion: '0',
    extra: '1D / AL',
    header: 'Field Day Mode Results',
    info1: '1D',
    info2: 'AL',
    label: 'Field Day',
    mode: 'fd',
  },
  {
    activeAfterCompletion: '0',
    extra: 'AL',
    header: 'POTA Mode Results',
    info1: 'AL',
    label: 'POTA',
    mode: 'pota',
  },
  {
    activeAfterCompletion: '0',
    extra: 'ADAM / AL',
    header: 'SST Mode Results',
    info1: 'Adam',
    info2: 'AL',
    label: 'SST',
    mode: 'sst',
  },
  {
    activeAfterCompletion: '0',
    extra: 'ADAM / 1',
    header: 'CWT Mode Results',
    info1: 'Adam',
    info2: '1',
    label: 'CWT',
    mode: 'cwt',
  },
];

const modeInfoLabels = {
  contest: ['Serial Number', null],
  cwt: ['Name', 'CW Ops No.'],
  fd: ['Class', 'Section'],
  pota: ['State', null],
  single: [null, null],
  sst: ['Name', 'State'],
};

const respondingNumberIds = [
  'maxStations',
  'minSpeed',
  'maxSpeed',
  'farnsworthSpeed',
  'minTone',
  'maxTone',
  'minVolume',
  'maxVolume',
  'minWait',
  'maxWait',
];

const respondingCheckboxIds = [
  'enableFarnsworth',
  'usOnly',
  '1x1',
  '1x2',
  '2x1',
  '2x2',
  '1x3',
  '2x3',
  'enableCutNumbers',
  'cutT',
  'cutA',
  'cutU',
  'cutV',
  'cutE',
  'cutG',
  'cutD',
  'cutN',
];

const customRespondingPreferences = {
  maxStations: 7,
  minSpeed: 12,
  maxSpeed: 36,
  enableFarnsworth: true,
  farnsworthSpeed: 8,
  minTone: 350,
  maxTone: 1050,
  minVolume: 10,
  maxVolume: 90,
  minWait: 0.5,
  maxWait: 3.25,
  usOnly: false,
  '1x1': true,
  '1x2': false,
  '2x1': false,
  '2x2': false,
  '1x3': false,
  '2x3': false,
  enableCutNumbers: true,
  cutT: false,
  cutA: true,
  cutU: true,
  cutV: true,
  cutE: true,
  cutG: true,
  cutD: true,
  cutN: false,
};

const defaultRespondingPreferences = {
  maxStations: 3,
  minSpeed: 18,
  maxSpeed: 25,
  enableFarnsworth: false,
  farnsworthSpeed: 10,
  minTone: 400,
  maxTone: 900,
  minVolume: 30,
  maxVolume: 100,
  minWait: 0.25,
  maxWait: 2,
  usOnly: true,
  '1x1': false,
  '1x2': true,
  '2x1': true,
  '2x2': true,
  '1x3': true,
  '2x3': true,
  enableCutNumbers: false,
  cutT: true,
  cutA: false,
  cutU: false,
  cutV: false,
  cutE: false,
  cutG: false,
  cutD: false,
  cutN: true,
};

const customEffectsPreferences = {
  qrn: 'heavy',
  qsb: true,
  qsbPercentage: 82,
};

const defaultEffectsPreferences = {
  qrn: 'normal',
  qsb: false,
  qsbPercentage: 50,
};

async function setPracticePreferences(page, responding, effects) {
  await page.evaluate(
    ({ checkboxIds, effectsValues, numberIds, respondingValues }) => {
      const updateValue = (id, value) => {
        const input = document.getElementById(id);
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const updateChecked = (id, checked) => {
        const input = document.getElementById(id);
        input.checked = checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };

      numberIds.forEach((id) => updateValue(id, respondingValues[id]));
      checkboxIds.forEach((id) => updateChecked(id, respondingValues[id]));
      ['off', 'normal', 'moderate', 'heavy'].forEach((level) => {
        const id = `qrn${level[0].toUpperCase()}${level.slice(1)}`;
        updateChecked(id, effectsValues.qrn === level);
      });
      updateChecked('qsb', effectsValues.qsb);
      updateValue('qsbPercentage', effectsValues.qsbPercentage);
    },
    {
      checkboxIds: respondingCheckboxIds,
      effectsValues: effects,
      numberIds: respondingNumberIds,
      respondingValues: responding,
    }
  );
}

async function practicePreferencesSnapshot(page) {
  return page.evaluate(
    ({ checkboxIds, numberIds }) => {
      const responding = {};
      numberIds.forEach((id) => {
        responding[id] = Number(document.getElementById(id).value);
      });
      checkboxIds.forEach((id) => {
        responding[id] = document.getElementById(id).checked;
      });

      return {
        responding,
        effects: {
          qrn: document.querySelector('input[name="qrn"]:checked').value,
          qsb: document.getElementById('qsb').checked,
          qsbPercentage: Number(document.getElementById('qsbPercentage').value),
        },
      };
    },
    {
      checkboxIds: respondingCheckboxIds,
      numberIds: respondingNumberIds,
    }
  );
}

async function accordionHeaderActionLayout(page, headerId, actionId) {
  return page.locator(`#${headerId}`).evaluate((header, id) => {
    const collapseButton = header.querySelector('.accordion-button');
    const heading = collapseButton.querySelector('h5');
    const action = document.getElementById(id);
    const headerRect = header.getBoundingClientRect();
    const collapseRect = collapseButton.getBoundingClientRect();
    const headingRect = heading.getBoundingClientRect();
    const actionRect = action.getBoundingClientRect();
    const collapseStyles = window.getComputedStyle(collapseButton);
    const caretStyles = window.getComputedStyle(collapseButton, '::after');
    const caretLeft =
      collapseRect.right -
      parseFloat(collapseStyles.paddingRight) -
      parseFloat(caretStyles.width);

    return {
      action: {
        bottom: actionRect.bottom,
        left: actionRect.left,
        right: actionRect.right,
        top: actionRect.top,
      },
      caretLeft,
      header: {
        bottom: headerRect.bottom,
        left: headerRect.left,
        right: headerRect.right,
        top: headerRect.top,
      },
      headingRight: headingRect.right,
      parentId: action.parentElement.id,
    };
  }, actionId);
}

test.beforeEach(async ({ page }) => {
  await installTestEnvironment(page);
});

test('production artifact boots with its required assets and no page errors', async ({
  page,
}) => {
  const pageErrors = [];
  const responseStatuses = new Map();

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    responseStatuses.set(new URL(response.url()).pathname, response.status());
  });

  await openApp(page);

  expect(responseStatuses.get('/')).toBe(200);
  expect(responseStatuses.get('/js/app.js')).toBe(200);
  expect(responseStatuses.get('/css/app.css')).toBe(200);

  await configureValidInputs(page, { qrn: 'normal' });
  const staticResponsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/audio/static.mp3'
  );
  await page.locator('#cqButton').click();

  const staticResponse = await staticResponsePromise;
  expect(staticResponse.status()).toBe(200);
  expect(responseStatuses.get('/audio/static.mp3')).toBe(200);
  await expect
    .poll(async () => (await audioSnapshot(page)).bufferSources)
    .toBeGreaterThan(0);

  await expect(page.locator('#activeStations')).toHaveText('1');
  expect(pageErrors).toEqual([]);
});

test('Your Station settings preserve their responsive information groups', async ({
  page,
}) => {
  await openApp(page);

  const stationInputs = page.locator('#collapseYourStationSettings input');
  const expectedOrder = [
    'yourCallsign',
    'yourSpeed',
    'yourSidetone',
    'yourVolume',
    'yourName',
    'yourState',
    'yourFieldDaySection',
    'yourFieldDayClass',
  ];
  expect(
    await stationInputs.evaluateAll((inputs) => inputs.map(({ id }) => id))
  ).toEqual(expectedOrder);

  const fourColumnRows = [expectedOrder.slice(0, 4), expectedOrder.slice(4)];
  const expectedRows = new Map([
    [
      390,
      [
        ['yourCallsign', 'yourSpeed'],
        ['yourSidetone', 'yourVolume'],
        ['yourName', 'yourState'],
        ['yourFieldDaySection', 'yourFieldDayClass'],
      ],
    ],
    [768, fourColumnRows],
    [992, fourColumnRows],
    [1199, fourColumnRows],
    [1200, [expectedOrder]],
  ]);

  for (const [width, expected] of expectedRows) {
    await page.setViewportSize({ width, height: 900 });
    const rows = await stationInputs.evaluateAll((inputs) => {
      const grouped = new Map();

      for (const input of inputs) {
        const top = Math.round(input.parentElement.getBoundingClientRect().top);
        const row = grouped.get(top) ?? [];
        row.push(input.id);
        grouped.set(top, row);
      }

      return [...grouped.values()];
    });

    expect(rows, `${width}px station rows`).toEqual(expected);
  }
});

test('Defaults actions remain visible and independent in accordion headers', async ({
  page,
}) => {
  await openApp(page);
  const actions = [
    {
      actionId: 'respondingStationDefaultsButton',
      collapseId: 'collapseRespondingStationSettings',
      headerId: 'headingRespondingStationSettings',
      name: 'Restore Responding Station defaults',
    },
    {
      actionId: 'effectsDefaultsButton',
      collapseId: 'collapseEffects',
      headerId: 'headingEffects',
      name: 'Restore Effects defaults',
    },
  ];

  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });

    for (const { actionId, headerId, name } of actions) {
      const action = page.getByRole('button', { name });
      await expect(action).toBeVisible();

      const layout = await accordionHeaderActionLayout(
        page,
        headerId,
        actionId
      );
      expect(layout.parentId).toBe(headerId);
      expect(layout.action.left).toBeGreaterThanOrEqual(layout.header.left);
      expect(layout.action.right).toBeLessThanOrEqual(layout.caretLeft - 1);
      expect(layout.action.top).toBeGreaterThanOrEqual(layout.header.top);
      expect(layout.action.bottom).toBeLessThanOrEqual(layout.header.bottom);
      expect(layout.headingRight).toBeLessThanOrEqual(layout.action.left + 1);
    }
  }

  const defaultsModal = page.locator('#settingsDefaultsModal');
  for (const { collapseId, name } of actions) {
    const collapse = page.locator(`#${collapseId}`);
    await expect(collapse).not.toHaveClass(/show/);

    await page.getByRole('button', { name }).click();

    await expect(defaultsModal).toBeVisible();
    await expect(collapse).not.toHaveClass(/show/);
    await defaultsModal.getByRole('button', { name: 'Cancel' }).click();
    await expect(defaultsModal).toBeHidden();
    await expect(collapse).not.toHaveClass(/show/);
  }

  for (const { actionId, collapseId, headerId, name } of actions) {
    const collapse = page.locator(`#${collapseId}`);
    const collapseButton = page.locator(`#${headerId} > .accordion-button`);
    const action = page.getByRole('button', { name });

    await collapseButton.click();
    await expect(collapse).toHaveClass(/show/);

    const appearance = await page.locator(`#${actionId}`).evaluate((button) => {
      const accordionButton =
        button.parentElement.querySelector('.accordion-button');
      const actionStyles = window.getComputedStyle(button);
      const accordionStyles = window.getComputedStyle(accordionButton);

      return {
        actionBackground: actionStyles.backgroundColor,
        accordionBackground: accordionStyles.backgroundColor,
        borderStyle: actionStyles.borderTopStyle,
        borderWidth: parseFloat(actionStyles.borderTopWidth),
        boxShadow: actionStyles.boxShadow,
      };
    });

    expect(appearance.actionBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(appearance.actionBackground).not.toBe(
      appearance.accordionBackground
    );
    expect(appearance.borderStyle).toBe('solid');
    expect(appearance.borderWidth).toBeGreaterThan(0);
    expect(appearance.boxShadow).not.toBe('none');

    await action.click();
    await expect(defaultsModal).toBeVisible();
    await expect(collapse).toHaveClass(/show/);
    await defaultsModal.getByRole('button', { name: 'Cancel' }).click();
    await expect(defaultsModal).toBeHidden();
    await expect(collapse).toHaveClass(/show/);

    await collapseButton.click();
    await expect(collapse).not.toHaveClass(/show/);
  }
});

for (const journey of modeJourneys) {
  test(`${journey.label} completes a deterministic mode-specific journey`, async ({
    page,
  }) => {
    await openApp(page);
    await configureValidInputs(page);
    await selectMode(page, journey.mode);

    await expect(page.locator('#modeResultsHeader')).toHaveText(journey.header);
    const [infoLabel1, infoLabel2] = modeInfoLabels[journey.mode];
    if (infoLabel1) {
      await expect(page.locator('#infoField')).toHaveAttribute(
        'aria-label',
        infoLabel1
      );
    }
    if (infoLabel2) {
      await expect(page.locator('#infoField2')).toHaveAttribute(
        'aria-label',
        infoLabel2
      );
    }

    if (journey.mode === 'single') {
      await page.keyboard.press('Control+Shift+C');
    } else {
      await page.locator('#cqButton').click();
    }

    await expect(page.locator('#activeStations')).toHaveText('1');
    await releaseAudio(page);

    const responseField = page.locator('#responseField');
    await responseField.fill('k0a');
    await responseField.press('Enter');

    if (journey.mode !== 'single') {
      await expect(page.locator('#infoField')).toBeFocused();
      await releaseAudio(page);
      await page.locator('#infoField').fill(journey.info1);

      let finalInfoField = page.locator('#infoField');
      if (journey.info2) {
        finalInfoField = page.locator('#infoField2');
        await finalInfoField.fill(journey.info2);
      }

      await setRandom(page, 0.9);
      await finalInfoField.press('Enter');
    }

    const row = page.locator('#resultsTable tbody tr').first();
    const cells = row.locator('td');

    await expect(page.locator('#resultsTable tbody tr')).toHaveCount(1);
    await expect(cells.nth(0)).toHaveText('1');
    await expect(cells.nth(1)).toHaveText('K0A');
    await expect(cells.nth(2)).toHaveText('18');
    await expect(cells.nth(3)).toHaveText('1');
    await expect(page.locator('#activeStations')).toHaveText(
      journey.activeAfterCompletion
    );
    await expect(responseField).toHaveValue('');

    if (journey.extra === null) {
      await expect(cells).toHaveCount(5);
    } else {
      await expect(cells).toHaveCount(6);
      await expect(cells.nth(5)).toContainText(journey.extra);
    }
  });
}

test('Enter and AGN repeat CWT fields and record each count', async ({
  page,
}) => {
  await openApp(page);
  await configureValidInputs(page);
  await selectMode(page, 'cwt');

  const agnButton = page.locator('#agnButton');
  const infoField = page.locator('#infoField');
  const infoField2 = page.locator('#infoField2');

  await expect(agnButton).toBeVisible();
  await expect(agnButton).toBeDisabled();

  await page.locator('#cqButton').click();
  await releaseAudio(page);
  await page.locator('#responseField').fill('K0A');
  await page.locator('#sendButton').click();

  await expect(infoField).toBeFocused();
  await expect(agnButton).toBeEnabled();
  await releaseAudio(page);

  await infoField.fill('Adam');
  const oneFieldEvents = (await audioSnapshot(page)).scheduledEvents;
  await infoField.press('Enter');

  await expect(infoField2).toBeFocused();
  await expect(infoField).toHaveValue('Adam');
  await expect(infoField2).toHaveValue('');
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
  await expect
    .poll(async () => (await audioSnapshot(page)).scheduledEvents)
    .toBeGreaterThan(oneFieldEvents);

  await releaseAudio(page);
  await infoField.fill('');
  const allFieldEvents = (await audioSnapshot(page)).scheduledEvents;
  await agnButton.click();

  await expect(infoField).toBeFocused();
  await expect(infoField).toHaveValue('');
  await expect(infoField2).toHaveValue('');
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
  await expect
    .poll(async () => (await audioSnapshot(page)).scheduledEvents)
    .toBeGreaterThan(allFieldEvents);

  await releaseAudio(page);
  await infoField.fill('Adam');
  await infoField2.fill('1');
  await expect(agnButton).toBeDisabled();

  await setRandom(page, 0.9);
  await page.locator('#tuButton').click();

  const cells = page.locator('#resultsTable tbody tr').first().locator('td');
  await expect(cells.nth(3)).toHaveText('3');
  await expect(cells.nth(5)).toContainText('ADAM (1 AGN) / 1 (2 AGN)');
});

test('Mode, AGN controls, and Help retain their responsive layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openApp(page);
  await configureValidInputs(page);
  await selectMode(page, 'cwt');

  const desktopActions = await page
    .locator('#agnButton, #tuButton')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y };
      })
    );
  expect(desktopActions[0].x).toBeLessThan(desktopActions[1].x);
  expect(Math.abs(desktopActions[0].y - desktopActions[1].y)).toBeLessThan(2);

  const modeHeading = page.getByRole('heading', {
    name: 'Mode',
    exact: true,
  });
  const modeSelector = page.locator('[aria-label="Mode selection"]');
  const modeButtons = modeSelector.locator('label');

  for (const width of [575, 576, 767]) {
    await page.setViewportSize({ width, height: 900 });
    const buttonTops = await modeButtons.evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().top))
    );
    expect(new Set(buttonTops).size, `${width}px mode rows`).toBe(1);
  }

  const stackedHeading = await modeHeading.boundingBox();
  const stackedSelector = await modeSelector.boundingBox();
  expect(stackedHeading.y + stackedHeading.height).toBeLessThanOrEqual(
    stackedSelector.y
  );

  await page.setViewportSize({ width: 768, height: 900 });
  const inlineHeading = await modeHeading.boundingBox();
  const inlineSelector = await modeSelector.boundingBox();
  const headingCenter = inlineHeading.y + inlineHeading.height / 2;
  const selectorCenter = inlineSelector.y + inlineSelector.height / 2;
  expect(inlineHeading.x + inlineHeading.width).toBeLessThanOrEqual(
    inlineSelector.x
  );
  expect(Math.abs(headingCenter - selectorCenter)).toBeLessThan(2);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('[data-bs-target="#helpModal"]').click();
  await expect(page.locator('#helpModal')).toBeVisible();
  await expect(page.locator('#helpModal .col-xl-4')).toHaveCount(6);
  await expect(page.locator('#modeInfoHelpCard button')).toHaveText('AGN');
  await expect(page.locator('#modeInfoHelpCard')).toContainText(
    'Only those fields repeat. The QSO stays open.'
  );

  const helpReferenceStyles = await page
    .locator('#helpModal')
    .evaluate((modal) => {
      const buttonsByLabel = new Map(
        [...modal.querySelectorAll('.card-header button')].map((button) => {
          const styles = window.getComputedStyle(button);
          return [
            button.textContent.trim(),
            {
              backgroundColor: styles.backgroundColor,
              color: styles.color,
            },
          ];
        })
      );

      return [...modal.querySelectorAll('.card-body kbd[class*="bg-"]')].map(
        (reference) => {
          const label = reference.textContent.trim();
          const styles = window.getComputedStyle(reference);
          return {
            button: buttonsByLabel.get(label),
            label,
            reference: {
              backgroundColor: styles.backgroundColor,
              color: styles.color,
            },
          };
        }
      );
    });
  expect(helpReferenceStyles).toHaveLength(11);
  for (const { button, label, reference } of helpReferenceStyles) {
    expect(reference, `${label} reference should match its button`).toEqual(
      button
    );
  }

  const desktopHelpColumns = await page
    .locator('#helpModal .col-xl-4')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, y: rect.y };
      })
    );
  expect(
    Math.abs(desktopHelpColumns[0].y - desktopHelpColumns[1].y)
  ).toBeLessThan(2);
  expect(
    Math.abs(desktopHelpColumns[1].y - desktopHelpColumns[2].y)
  ).toBeLessThan(2);
  expect(
    Math.abs(desktopHelpColumns[3].y - desktopHelpColumns[4].y)
  ).toBeLessThan(2);
  expect(
    Math.abs(desktopHelpColumns[4].y - desktopHelpColumns[5].y)
  ).toBeLessThan(2);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileHelpColumns = await page
    .locator('#helpModal .col-xl-4')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, y: rect.y };
      })
    );
  for (let index = 1; index < mobileHelpColumns.length; index += 1) {
    expect(mobileHelpColumns[index].y).toBeGreaterThan(
      mobileHelpColumns[index - 1].y
    );
  }
  expect(
    Math.max(...mobileHelpColumns.map(({ width }) => width)) -
      Math.min(...mobileHelpColumns.map(({ width }) => width))
  ).toBeLessThan(2);

  await page.locator('#helpModal [data-bs-dismiss="modal"]').last().click();
  await expect(page.locator('#helpModal')).toBeHidden();

  const mobileModeButtons = await page
    .locator('[aria-label="Mode selection"] label')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: Math.round(rect.top),
        };
      })
    );
  expect(mobileModeButtons).toHaveLength(6);
  expect(new Set(mobileModeButtons.map(({ top }) => top)).size).toBeGreaterThan(
    1
  );
  for (const button of mobileModeButtons) {
    expect(button.left).toBeGreaterThanOrEqual(0);
    expect(button.right).toBeLessThanOrEqual(390);
  }

  const mobileControls = await page
    .locator('#infoField, #infoField2, #agnButton, #tuButton')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          top: rect.top,
        };
      })
    );
  for (const control of mobileControls) {
    expect(control.left).toBeGreaterThanOrEqual(0);
    expect(control.right).toBeLessThanOrEqual(390);
  }
  for (let first = 0; first < mobileControls.length; first += 1) {
    for (let second = first + 1; second < mobileControls.length; second += 1) {
      const a = mobileControls[first];
      const b = mobileControls[second];
      const overlaps =
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top;
      expect(overlaps).toBe(false);
    }
  }
});

test('repeat, partial, and QRS requests recover into a completed contact', async ({
  page,
}) => {
  await openApp(page);
  await configureValidInputs(page);
  await page.locator('#cqButton').click();
  await expect(page.locator('#activeStations')).toHaveText('1');

  const responseField = page.locator('#responseField');
  for (const response of ['?', 'K', 'QRS']) {
    const scheduledBefore = (await audioSnapshot(page)).scheduledEvents;
    await releaseAudio(page);
    await responseField.fill(response);
    await responseField.press('Enter');

    await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
    await expect
      .poll(async () => (await audioSnapshot(page)).scheduledEvents)
      .toBeGreaterThan(scheduledBefore);
  }

  expect((await audioSnapshot(page)).oscillators).toBe(3);

  await releaseAudio(page);
  await responseField.fill('K0A');
  await responseField.press('Enter');

  const cells = page.locator('#resultsTable tbody tr').first().locator('td');
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(1);
  await expect(cells.nth(1)).toHaveText('K0A');
  await expect(cells.nth(2)).toHaveText('18 / 12');
  await expect(cells.nth(3)).toHaveText('4');
});

test('invalid CQ is rejected before a station or audio starts', async ({
  page,
}) => {
  await openApp(page);
  await configureValidInputs(page, { qrn: 'normal' });
  await page.locator('#yourCallsign').fill('');
  await page.locator('#cqButton').click();

  await expect(page.locator('#yourCallsign')).toHaveClass(/is-invalid/);
  await expect(page.locator('#yourCallsign + .invalid-feedback')).toHaveText(
    'Your callsign is required.'
  );
  await expect(page.locator('#activeStations')).toHaveText('0');
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
  expect(await audioSnapshot(page)).toMatchObject({
    bufferSources: 0,
    scheduledEvents: 0,
  });
});

test('Reset, mode switching, and persisted station settings survive a reload', async ({
  page,
}) => {
  await openApp(page);
  await configureValidInputs(page);

  await page.locator('#cqButton').click();
  await releaseAudio(page);
  await page.locator('#responseField').fill('K0A');
  await page.locator('#sendButton').click();
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(1);

  await page.locator('#resetButton').click();
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
  await expect(page.locator('#activeStations')).toHaveText('0');
  await expect(page.locator('#responseField')).toHaveValue('');
  await expect(page.locator('#cqButton')).toBeEnabled();

  await page.locator('#cqButton').click();
  await expect(page.locator('#activeStations')).toHaveText('1');
  await page.locator('#stopButton').click();
  await expect(page.locator('#activeStations')).toHaveText('0');
  await expect(page.locator('#cqButton')).toBeEnabled();

  await releaseAudio(page);
  await page.locator('#cqButton').click();
  await expect(page.locator('#activeStations')).toHaveText('1');
  await page.locator('#responseField').fill('stale');
  await selectMode(page, 'cwt');

  await expect(page.locator('#modeResultsHeader')).toHaveText(
    'CWT Mode Results'
  );
  await expect(page.locator('#activeStations')).toHaveText('0');
  await expect(page.locator('#responseField')).toHaveValue('');
  await expect(page.locator('#infoField')).toHaveAttribute(
    'placeholder',
    'Name'
  );
  await expect(page.locator('#infoField2')).toHaveAttribute(
    'placeholder',
    'CW Ops No.'
  );

  await page.locator('#yourCallsign').fill('W1AW');
  await page.locator('#yourFieldDayClass').fill('3A');
  await page.locator('#yourFieldDaySection').fill('CT');
  await page.locator('#yourName').fill('MAYA');
  await page.locator('#yourState').fill('TX');
  await page.locator('#yourSpeed').fill('24');
  await page.locator('#yourSidetone').fill('650');
  await page.locator('#yourVolume').fill('55');

  await page.reload();
  await expect
    .poll(async () => (await audioSnapshot(page)).statsRequests.length)
    .toBe(1);
  const [{ body: statsBody }] = (await audioSnapshot(page)).statsRequests;

  expect(JSON.parse(statsBody)).toEqual({
    callsign: 'W1AW',
    mode: 'cwt',
  });
  await expect(page.locator('#modeCwt')).toBeChecked();
  await expect(page.locator('#modeResultsHeader')).toHaveText(
    'CWT Mode Results'
  );
  await expect(page.locator('#yourCallsign')).toHaveValue('W1AW');
  await expect(page.locator('#yourFieldDayClass')).toHaveValue('3A');
  await expect(page.locator('#yourFieldDaySection')).toHaveValue('CT');
  await expect(page.locator('#yourName')).toHaveValue('MAYA');
  await expect(page.locator('#yourState')).toHaveValue('TX');
  await expect(page.locator('#yourSpeed')).toHaveValue('24');
  await expect(page.locator('#yourSidetone')).toHaveValue('650');
  await expect(page.locator('#yourVolume')).toHaveValue('55');
});

test('practice preferences persist and each Defaults action remains section-scoped', async ({
  page,
}) => {
  await openApp(page);
  await configureValidInputs(page);
  await selectMode(page, 'cwt');
  await page.locator('#yourCallsign').fill('W1AW');
  await page.locator('#yourName').fill('MAYA');
  await page.locator('#yourSpeed').fill('24');
  await setPracticePreferences(
    page,
    customRespondingPreferences,
    customEffectsPreferences
  );

  await page.reload();
  await expect(page.locator('#modeResultsHeader')).toHaveText(
    'CWT Mode Results'
  );
  expect(await practicePreferencesSnapshot(page)).toEqual({
    responding: customRespondingPreferences,
    effects: customEffectsPreferences,
  });
  await expect(page.locator('#yourCallsign')).toHaveValue('W1AW');
  await expect(page.locator('#yourName')).toHaveValue('MAYA');
  await expect(page.locator('#yourSpeed')).toHaveValue('24');
  await expect(page.locator('#farnsworthSpeed')).toBeEnabled();
  await expect(page.locator('#cutA')).toBeEnabled();
  await expect(page.locator('#qsbPercentage')).toBeEnabled();
  await expect(page.locator('#qsbValue')).toHaveText('82%');

  await page
    .locator('#headingRespondingStationSettings .accordion-button')
    .click();
  await expect(page.locator('#collapseRespondingStationSettings')).toHaveClass(
    /show/
  );
  const respondingDefaults = page.getByRole('button', {
    name: 'Restore Responding Station defaults',
  });
  await expect(respondingDefaults).toHaveText('Defaults');
  await respondingDefaults.click();

  const defaultsModal = page.locator('#settingsDefaultsModal');
  await expect(defaultsModal).toBeVisible();
  await expect(page.locator('#settingsDefaultsModalLabel')).toHaveText(
    'Restore Responding Station Settings to defaults?'
  );
  await expect(page.locator('#settingsDefaultsModalDescription')).toContainText(
    'Your Station and Effects settings will not change.'
  );

  await defaultsModal.getByRole('button', { name: 'Cancel' }).click();
  await expect(defaultsModal).toBeHidden();
  expect(await practicePreferencesSnapshot(page)).toEqual({
    responding: customRespondingPreferences,
    effects: customEffectsPreferences,
  });

  await respondingDefaults.click();
  await defaultsModal.getByRole('button', { name: 'Restore defaults' }).click();
  await expect(defaultsModal).toBeHidden();
  expect(await practicePreferencesSnapshot(page)).toEqual({
    responding: defaultRespondingPreferences,
    effects: customEffectsPreferences,
  });
  await expect(page.locator('#farnsworthSpeed')).toBeDisabled();
  await expect(page.locator('#cutA')).toBeDisabled();
  await expect(page.locator('#qsbPercentage')).toBeEnabled();
  await expect(page.locator('#yourCallsign')).toHaveValue('W1AW');
  await expect(page.locator('#modeCwt')).toBeChecked();

  await page.reload();
  expect(await practicePreferencesSnapshot(page)).toEqual({
    responding: defaultRespondingPreferences,
    effects: customEffectsPreferences,
  });
  await expect(page.locator('#yourCallsign')).toHaveValue('W1AW');
  await expect(page.locator('#modeCwt')).toBeChecked();

  await page.locator('#headingEffects .accordion-button').click();
  await expect(page.locator('#collapseEffects')).toHaveClass(/show/);
  const effectsDefaults = page.getByRole('button', {
    name: 'Restore Effects defaults',
  });
  await expect(effectsDefaults).toHaveText('Defaults');
  await effectsDefaults.click();

  await expect(defaultsModal).toBeVisible();
  await expect(page.locator('#settingsDefaultsModalLabel')).toHaveText(
    'Restore Effects Settings to defaults?'
  );
  await expect(page.locator('#settingsDefaultsModalDescription')).toContainText(
    'Your Station and Responding Station settings will not change.'
  );
  await defaultsModal.getByRole('button', { name: 'Restore defaults' }).click();
  await expect(defaultsModal).toBeHidden();
  expect(await practicePreferencesSnapshot(page)).toEqual({
    responding: defaultRespondingPreferences,
    effects: defaultEffectsPreferences,
  });
  await expect(page.locator('#qsbPercentage')).toBeDisabled();
  await expect(page.locator('#qsbValue')).toHaveText('50%');
  await expect(page.locator('#yourCallsign')).toHaveValue('W1AW');
  await expect(page.locator('#yourName')).toHaveValue('MAYA');

  await page.reload();
  expect(await practicePreferencesSnapshot(page)).toEqual({
    responding: defaultRespondingPreferences,
    effects: defaultEffectsPreferences,
  });
  await expect(page.locator('#yourCallsign')).toHaveValue('W1AW');
  await expect(page.locator('#yourName')).toHaveValue('MAYA');
  await expect(page.locator('#yourSpeed')).toHaveValue('24');
  await expect(page.locator('#modeCwt')).toBeChecked();
});
