import { expect, test } from '@playwright/test';

import {
  audioContextSnapshots,
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
      const colorChannels = (value) =>
        (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

      return {
        actionBackground: actionStyles.backgroundColor,
        accordionBackground: accordionStyles.backgroundColor,
        backgroundChannels: colorChannels(actionStyles.backgroundColor),
        borderChannels: colorChannels(actionStyles.borderTopColor),
        borderRadius: parseFloat(actionStyles.borderTopLeftRadius),
        borderStyle: actionStyles.borderTopStyle,
        borderWidth: parseFloat(actionStyles.borderTopWidth),
        boxShadow: actionStyles.boxShadow,
        textChannels: colorChannels(actionStyles.color),
      };
    });

    expect(appearance.actionBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(appearance.actionBackground).not.toBe(
      appearance.accordionBackground
    );
    expect(appearance.borderStyle).toBe('solid');
    expect(appearance.borderWidth).toBeGreaterThan(0);
    expect(appearance.borderRadius).toBeGreaterThan(0);
    expect(appearance.backgroundChannels).toHaveLength(3);
    expect(appearance.borderChannels[2]).toBeGreaterThan(
      appearance.borderChannels[0]
    );
    expect(appearance.textChannels[2]).toBeGreaterThan(
      appearance.textChannels[0]
    );
    expect(appearance.boxShadow).toBe('none');

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

for (const mode of ['pota', 'sst']) {
  test(`${mode.toUpperCase()} international Enter completion skips unavailable state`, async ({
    page,
  }) => {
    const pageErrors = [];
    const sentRequests = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      const sentRequest = message.text().match(/^--> Sending "(.*)"$/);
      if (sentRequest) sentRequests.push(sentRequest[1]);
    });

    await openApp(page);
    await configureValidInputs(page);
    await selectMode(page, mode);
    await page.evaluate(() => {
      const setChecked = (id, checked) => {
        const input = document.getElementById(id);
        input.checked = checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setChecked('usOnly', false);
      for (const format of ['1x1', '1x2', '1x3', '2x1', '2x2', '2x3']) {
        setChecked(format, format === '2x2');
      }
    });
    await setRandom(page, 0.99);
    await page.locator('#cqButton').click();
    await expect(page.locator('#activeStations')).toHaveText('1');
    await releaseAudio(page);

    const responseField = page.locator('#responseField');
    const infoField = page.locator('#infoField');
    const stateField = page.locator(
      mode === 'sst' ? '#infoField2' : '#infoField'
    );
    await responseField.fill('YT9ZZ');
    await responseField.press('Enter');
    await expect(infoField).toBeFocused();
    await expect(stateField).toHaveValue('');
    await releaseAudio(page);

    if (mode === 'sst') {
      const beforeFill = await audioSnapshot(page);
      await stateField.press('Enter');

      await expect.poll(() => sentRequests.at(-1)).toBe('NAME?');
      await expect(infoField).toBeFocused();
      await expect(stateField).toHaveValue('');
      await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
      expect((await audioSnapshot(page)).scheduledEvents).toBeGreaterThan(
        beforeFill.scheduledEvents
      );
      await releaseAudio(page);
      await infoField.fill('Yan');
    }

    const beforeCompletion = await audioSnapshot(page);
    await infoField.press('Enter');

    const cells = page.locator('#resultsTable tbody tr').first().locator('td');
    await expect(page.locator('#resultsTable tbody tr')).toHaveCount(1);
    await expect(cells.nth(1)).toHaveText('YT9ZZ');
    await expect(cells.nth(3)).toHaveText(mode === 'sst' ? '2' : '1');
    await expect(cells.nth(5)).toHaveText(
      mode === 'sst' ? 'YAN (1 AGN) / N/A' : 'N/A'
    );
    await expect(page.locator('#activeStations')).toHaveText('0');
    await expect(page.locator('#agnButton')).toBeDisabled();
    await expect(responseField).toHaveValue('');
    await expect(responseField).toBeFocused();
    expect((await audioSnapshot(page)).scheduledEvents).toBeGreaterThan(
      beforeCompletion.scheduledEvents
    );
    expect(sentRequests).toEqual(
      mode === 'sst' ? ['YT9ZZ', 'NAME?'] : ['YT9ZZ']
    );
    expect(pageErrors).toEqual([]);
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

for (const mode of ['single', 'contest']) {
  for (const speed of [5, 6]) {
    test(`${mode} QRS floor preserves character timing and completes a ${speed} WPM contact`, async ({
      page,
    }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await openApp(page);
      await configureValidInputs(page, {
        minSpeed: String(speed),
        maxSpeed: String(speed),
      });
      await selectMode(page, mode);
      await page.locator('#cqButton').click();
      await expect(page.locator('#activeStations')).toHaveText('1');

      const readCallerGains = () =>
        page.evaluate(() =>
          globalThis.__morseTest
            .gainSnapshots()
            .filter(({ frequency }) => frequency === 400)
        );
      const expectCallsignTiming = (events, letterGap) => {
        // K0A has ten symbols. With QSB off and nonzero volume, each symbol
        // produces six gain events; event 4 is its nominal end, before the
        // final zero event at end + 0.001 seconds.
        const symbols = [...'-.-', ...'-----', ...'.-'];
        expect(events).toHaveLength(symbols.length * 6);
        events.forEach(({ time }, index) => {
          expect(Number.isFinite(time)).toBe(true);
          expect(time).toBeGreaterThanOrEqual(0);
          if (index > 0) {
            expect(time).toBeGreaterThanOrEqual(events[index - 1].time);
          }
        });

        const windows = symbols.map((symbol, index) => ({
          start: events[index * 6].time,
          end: events[index * 6 + 4].time,
          duration: (symbol === '-' ? 3 : 1) * (1.2 / speed),
        }));
        windows.forEach(({ start, end, duration }, index) => {
          expect(end - start).toBeCloseTo(duration, 6);
          if (index > 0) {
            const gap = index === 3 || index === 8 ? letterGap : 1.2 / speed;
            expect(start - windows[index - 1].end).toBeCloseTo(gap, 6);
          }
        });
      };

      let callerGains = await readCallerGains();
      expectCallsignTiming(callerGains.at(-1).events, (3 * 1.2) / speed);
      for (const request of ['first', 'repeated']) {
        await test.step(`${request} QRS stays at the 5 WPM floor`, async () => {
          await releaseAudio(page);
          await page.locator('#responseField').fill('QRS');
          await page.locator('#responseField').press('Enter');

          const nextCallerGains = await readCallerGains();
          expect(nextCallerGains).toHaveLength(callerGains.length + 1);
          expectCallsignTiming(nextCallerGains.at(-1).events, 0.72);
          callerGains = nextCallerGains;
          await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
          await expect(page.locator('#activeStations')).toHaveText('1');
          expect(pageErrors).toEqual([]);
        });
      }

      await releaseAudio(page);
      await page.locator('#responseField').fill('K0A');
      await page.locator('#responseField').press('Enter');
      if (mode === 'contest') {
        await releaseAudio(page);
        await page.locator('#infoField').fill('01');
        await setRandom(page, 0.9);
        await page.locator('#tuButton').click();
      }

      const rows = page.locator('#resultsTable tbody tr');
      await expect(rows).toHaveCount(1);
      const cells = rows.first().locator('td');
      await expect(cells.nth(1)).toHaveText('K0A');
      await expect(cells.nth(2)).toHaveText(`${speed} / 5`);
      await expect(cells.nth(3)).toHaveText('3');
      await expect(page.locator('#activeStations')).toHaveText(
        mode === 'single' ? '1' : '0'
      );
      expect(pageErrors).toEqual([]);
    });
  }
}

test('Field Day keeps its active settings snapshot when TU schedules another caller', async ({
  page,
}) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await openApp(page);
  await configureValidInputs(page);
  await selectMode(page, 'fd');
  await page.locator('#cqButton').click();
  await releaseAudio(page);
  await page.locator('#responseField').fill('K0A');
  await page.locator('#sendButton').click();
  await releaseAudio(page);

  await page.locator('#yourFieldDayClass').fill('');
  await page.locator('#yourFieldDaySection').fill('');
  await page.locator('#infoField').fill('1D');
  await page.locator('#infoField2').fill('AL');
  const beforeNextCaller = await audioSnapshot(page);
  await page.locator('#tuButton').click();

  expect(pageErrors).toEqual([]);
  const afterNextCaller = await audioSnapshot(page);
  expect(afterNextCaller.oscillators).toBe(beforeNextCaller.oscillators + 1);
  expect(afterNextCaller.scheduledEvents).toBeGreaterThan(
    beforeNextCaller.scheduledEvents
  );
  await expect(page.locator('#activeStations')).toHaveText('1');
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(1);
  await expect(page.locator('#yourFieldDayClass')).toHaveValue('');
  await expect(page.locator('#yourFieldDaySection')).toHaveValue('');

  await releaseAudio(page);
  await page.locator('#responseField').fill('K0A');
  await page.locator('#sendButton').click();
  await releaseAudio(page);
  await page.locator('#infoField').fill('1D');
  await page.locator('#infoField2').fill('AL');
  await setRandom(page, 0.9);
  await page.locator('#tuButton').click();
  const latestCells = page
    .locator('#resultsTable tbody tr')
    .first()
    .locator('td');
  await expect(latestCells.nth(0)).toHaveText('2');
  await expect(latestCells.nth(2)).toHaveText('18');
  await expect(latestCells.nth(5)).toContainText('1D / AL');

  await page.locator('#stopButton').click();
  const beforeRejectedCq = await audioSnapshot(page);
  await page.locator('#cqButton').click();
  await expect(page.locator('#yourFieldDayClass')).toHaveClass(/is-invalid/);
  await expect(page.locator('#yourFieldDaySection')).toHaveClass(/is-invalid/);
  expect(await audioSnapshot(page)).toEqual(beforeRejectedCq);
  expect(pageErrors).toEqual([]);
});

test('Single keeps its active settings snapshot when completing callers after invalid edits', async ({
  page,
}) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await openApp(page);
  await configureValidInputs(page);
  await page.locator('#cqButton').click();
  await releaseAudio(page);
  await page.evaluate(() => {
    for (const [id, value] of Object.entries({
      minSpeed: '30',
      maxSpeed: '30',
      minTone: '0',
    })) {
      const input = document.getElementById(id);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  for (const resultNumber of ['1', '2']) {
    const beforeNextCaller = await audioSnapshot(page);
    await page.locator('#responseField').fill('K0A');
    await page.locator('#sendButton').click();

    expect(pageErrors).toEqual([]);
    const afterNextCaller = await audioSnapshot(page);
    expect(afterNextCaller.oscillators).toBe(beforeNextCaller.oscillators + 1);
    expect(afterNextCaller.scheduledEvents).toBeGreaterThan(
      beforeNextCaller.scheduledEvents
    );
    const latestCells = page
      .locator('#resultsTable tbody tr')
      .first()
      .locator('td');
    await expect(latestCells.nth(0)).toHaveText(resultNumber);
    await expect(latestCells.nth(1)).toHaveText('K0A');
    await expect(latestCells.nth(2)).toHaveText('18');
    await expect(page.locator('#activeStations')).toHaveText('1');
    await releaseAudio(page);
  }

  await expect(page.locator('#minSpeed')).toHaveValue('30');
  await expect(page.locator('#maxSpeed')).toHaveValue('30');
  await expect(page.locator('#minTone')).toHaveValue('0');
  await page.locator('#stopButton').click();
  const beforeRejectedCq = await audioSnapshot(page);
  await page.locator('#cqButton').click();
  await expect(page.locator('#minTone')).toHaveClass(/is-invalid/);
  await expect(page.locator('#activeStations')).toHaveText('0');
  expect(await audioSnapshot(page)).toEqual(beforeRejectedCq);
  expect(pageErrors).toEqual([]);
});

for (const request of ['AGN', 'QRS']) {
  test(`Contest keeps its active settings snapshot for ${request} after invalid edits`, async ({
    page,
  }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await openApp(page);
    await configureValidInputs(page);
    await selectMode(page, 'contest');
    await page.locator('#cqButton').click();
    await releaseAudio(page);
    await page.locator('#minTone').evaluate((input) => {
      input.value = '0';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const beforeRepeat = await audioSnapshot(page);
    await page.locator('#responseField').fill(request);
    await page.locator('#sendButton').click();

    expect(pageErrors).toEqual([]);
    const afterRepeat = await audioSnapshot(page);
    expect(afterRepeat.oscillators).toBe(beforeRepeat.oscillators + 1);
    expect(afterRepeat.scheduledEvents).toBeGreaterThan(
      beforeRepeat.scheduledEvents
    );
    await expect(page.locator('#activeStations')).toHaveText('1');
    await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);

    await releaseAudio(page);
    await page.locator('#responseField').fill('K0A');
    await page.locator('#sendButton').click();
    await releaseAudio(page);
    const beforeFill = await audioSnapshot(page);
    await page.locator('#agnButton').click();
    expect((await audioSnapshot(page)).scheduledEvents).toBeGreaterThan(
      beforeFill.scheduledEvents
    );
    await releaseAudio(page);
    await page.locator('#infoField').fill('01');
    await setRandom(page, 0.9);
    await page.locator('#tuButton').click();

    const cells = page.locator('#resultsTable tbody tr').first().locator('td');
    await expect(cells.nth(1)).toHaveText('K0A');
    await expect(cells.nth(2)).toHaveText(request === 'QRS' ? '18 / 12' : '18');
    await expect(cells.nth(3)).toHaveText('3');
    await expect(cells.nth(5)).toContainText('1 (1 AGN)');
    await expect(page.locator('#minTone')).toHaveValue('0');

    await page.locator('#stopButton').click();
    const beforeRejectedCq = await audioSnapshot(page);
    await page.locator('#cqButton').click();
    await expect(page.locator('#minTone')).toHaveClass(/is-invalid/);
    expect(await audioSnapshot(page)).toEqual(beforeRejectedCq);
    expect(pageErrors).toEqual([]);
  });
}

for (const action of ['Send', 'AGN', 'TU']) {
  test(`Contest retains its snapshot for ${action} after rejected CQ`, async ({
    page,
  }) => {
    const pageErrors = [];
    const sentRequests = [];
    const initializations = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      const text = message.text();
      const sentRequest = text.match(/^--> Sending "(.*)"$/);
      if (sentRequest) sentRequests.push(sentRequest[1]);
      if (text.startsWith('/ Initializing K0A:')) initializations.push(text);
    });

    await openApp(page);
    await configureValidInputs(page);
    await selectMode(page, 'contest');
    await page.locator('#cqButton').click();
    await releaseAudio(page);

    const responseField = page.locator('#responseField');
    const infoField = page.locator('#infoField');
    if (action !== 'Send') {
      await responseField.fill('K0A');
      await page.locator('#sendButton').click();
      await releaseAudio(page);
    }
    if (action === 'TU') await infoField.fill('01');

    await page.evaluate(() => {
      for (const [id, value] of Object.entries({
        minSpeed: '0',
        maxSpeed: '30',
      })) {
        const input = document.getElementById(id);
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      for (const id of ['enableCutNumbers', 'cutT', 'cutA']) {
        const input = document.getElementById(id);
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    const beforeRejectedCq = await audioSnapshot(page);
    const initializationsBeforeRejection = initializations.length;
    await page.locator('#cqButton').click();

    await expect(page.locator('#minSpeed')).toHaveClass(/is-invalid/);
    await expect(page.locator('#minSpeed + .invalid-feedback')).toHaveText(
      'Must be ≥ 5'
    );
    await expect(page.locator('#activeStations')).toHaveText('1');
    await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
    await expect(infoField).toHaveValue(action === 'TU' ? '01' : '');
    expect(await audioSnapshot(page)).toEqual(beforeRejectedCq);
    expect(initializations).toHaveLength(initializationsBeforeRejection);
    expect(pageErrors).toEqual([]);

    if (action === 'Send') {
      await page.locator('#minSpeed').fill('30');
      await responseField.fill('K0A');
      await page.locator('#sendButton').click();
      expect(pageErrors).toEqual([]);
      await expect(infoField).toBeFocused();
      await expect(page.locator('#agnButton')).toBeEnabled();
    } else if (action === 'AGN') {
      await page.locator('#agnButton').click();
      expect(pageErrors).toEqual([]);
      await expect.poll(() => sentRequests.at(-1)).toBe('NR?');
      await expect(page.locator('#minSpeed')).toHaveValue('0');
      await expect(page.locator('#minSpeed')).toHaveClass(/is-invalid/);
      await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
    } else {
      await setRandom(page, 0);
      await page.locator('#tuButton').click();
      expect(pageErrors).toEqual([]);
    }

    const afterAction = await audioSnapshot(page);
    expect(afterAction.scheduledEvents).toBeGreaterThan(
      beforeRejectedCq.scheduledEvents
    );
    expect(afterAction.oscillators).toBe(
      beforeRejectedCq.oscillators + (action === 'TU' ? 1 : 0)
    );

    if (action !== 'TU') {
      await releaseAudio(page);
      await infoField.fill('01');
      await setRandom(page, 0.9);
      await page.locator('#tuButton').click();
    } else {
      await expect
        .poll(() => initializations.length)
        .toBe(initializationsBeforeRejection + 1);
      expect(initializations.at(-1)).toContain('400Hz@18wpm');
    }

    const cells = page.locator('#resultsTable tbody tr').first().locator('td');
    await expect(page.locator('#resultsTable tbody tr')).toHaveCount(1);
    await expect(cells.nth(1)).toHaveText('K0A');
    await expect(cells.nth(2)).toHaveText('18');
    await expect(cells.nth(3)).toHaveText(action === 'AGN' ? '2' : '1');
    await expect(cells.nth(5)).toHaveText(action === 'AGN' ? '1 (1 AGN)' : '1');
    await expect(page.locator('#activeStations')).toHaveText(
      action === 'TU' ? '1' : '0'
    );
    await expect(page.locator('#minSpeed')).toHaveValue(
      action === 'Send' ? '30' : '0'
    );
    await expect(page.locator('#maxSpeed')).toHaveValue('30');
    await expect(page.locator('#enableCutNumbers')).toBeChecked();
    await expect(page.locator('#cutT')).toBeChecked();
    await expect(page.locator('#cutA')).toBeChecked();
    expect(pageErrors).toEqual([]);
  });
}

for (const scenario of [
  {
    label: 'sidetone',
    mutedFrequencies: [600],
    settings: { yourVolume: '0' },
  },
  {
    label: 'caller',
    mutedFrequencies: [400],
    settings: { minVolume: '0', maxVolume: '0' },
  },
  {
    label: 'sidetone and caller',
    mutedFrequencies: [600, 400],
    settings: { yourVolume: '0', minVolume: '0', maxVolume: '0' },
  },
]) {
  test(`zero volume for ${scenario.label} preserves a complete Single contact and next caller`, async ({
    page,
  }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await openApp(page);
    await configureValidInputs(page, scenario.settings);
    await expect(page.locator('#qrnOff')).toBeChecked();
    await page.locator('#cqButton').click();

    expect(pageErrors).toEqual([]);
    await expect(page.locator('#activeStations')).toHaveText('1');
    const afterCq = await audioSnapshot(page);
    expect(afterCq.oscillators).toBe(2);
    expect(afterCq.scheduledEvents).toBeGreaterThan(0);
    expect(afterCq.bufferSources).toBe(0);

    await releaseAudio(page);
    await page.locator('#responseField').fill('K0A');
    await page.locator('#sendButton').click();

    expect(pageErrors).toEqual([]);
    const rows = page.locator('#resultsTable tbody tr');
    await expect(rows).toHaveCount(1);
    const cells = rows.first().locator('td');
    await expect(cells.nth(1)).toHaveText('K0A');
    await expect(cells.nth(2)).toHaveText('18');
    await expect(cells.nth(3)).toHaveText('1');
    await expect(page.locator('#responseField')).toHaveValue('');
    await expect(page.locator('#activeStations')).toHaveText('1');
    const afterContact = await audioSnapshot(page);
    expect(afterContact.oscillators).toBe(afterCq.oscillators + 1);
    expect(afterContact.scheduledEvents).toBeGreaterThan(
      afterCq.scheduledEvents
    );

    const gains = await page.evaluate(() =>
      globalThis.__morseTest.gainSnapshots()
    );
    expect(gains).toHaveLength(3);
    for (const gain of gains) {
      expect(gain.events.length).toBeGreaterThan(0);
      expect(gain.events.every((event) => Number.isFinite(event.time))).toBe(
        true
      );
      if (scenario.mutedFrequencies.includes(gain.frequency)) {
        expect(gain.value).toBe(0);
        expect(gain.events.every((event) => event.value === 0)).toBe(true);
      } else {
        expect(gain.events.some((event) => event.value > 0)).toBe(true);
      }
    }
    expect(gains.at(-1).events.some((event) => event.time >= 1000)).toBe(true);
    expect(pageErrors).toEqual([]);
  });
}

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

test('Stop clears an unselected pileup and immediately starts fresh players with new settings', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openApp(page);
  await configureValidInputs(page);
  await selectMode(page, 'contest');
  await page.locator('#cqButton').click();
  await releaseAudio(page);
  const oldContext = (await audioContextSnapshots(page)).at(-1);
  expect(oldContext.currentTime).toBeGreaterThanOrEqual(1000);

  await configureValidInputs(page, {
    yourCallsign: 'W1AW',
    yourSpeed: '30',
    yourSidetone: '750',
    minSpeed: '30',
    maxSpeed: '30',
    minTone: '800',
    maxTone: '800',
  });
  await page.locator('#stopButton').click();

  await expect(page.locator('#activeStations')).toHaveText('0');
  await expect(page.locator('#cqButton')).toBeEnabled();
  await expect(page.locator('#yourCallsign')).toHaveValue('W1AW');
  await expect(page.locator('#minSpeed')).toHaveValue('30');
  const stoppedContexts = await audioContextSnapshots(page);
  expect(stoppedContexts[oldContext.id]).toEqual({
    ...oldContext,
    state: 'closed',
  });
  expect(stoppedContexts.at(-1)).toMatchObject({
    currentTime: 0,
    oscillators: 0,
    gains: 0,
    scheduledEvents: 0,
  });

  // Do not advance time: a deadline from the old clock would block this CQ.
  await page.locator('#cqButton').click();
  const restartedContexts = await audioContextSnapshots(page);
  expect(restartedContexts[oldContext.id]).toEqual(
    stoppedContexts[oldContext.id]
  );
  expect(restartedContexts.at(-1)).toMatchObject({
    id: stoppedContexts.at(-1).id,
    state: 'running',
    currentTime: 0,
    oscillators: 2,
    frequencies: [750, 800],
  });
  expect(restartedContexts.at(-1).scheduledEvents).toBeGreaterThan(0);
  expect(restartedContexts.at(-1).lastScheduledTime).toBeLessThan(100);
  await expect(page.locator('#activeStations')).toHaveText('1');
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Stop discards a selected exchange and blocks stale actions while preserving completed results', async ({
  page,
}) => {
  const results = page.locator(
    '#resultsTable tbody tr:not(#resultsTable-summary)'
  );
  const readResult = (row) =>
    row.evaluate((element) =>
      [...element.cells].map((cell) => ({
        text: cell.textContent.replace(/\s+/g, ' ').trim(),
        scoringClasses: [
          ...cell.querySelectorAll('.text-success, .text-warning'),
        ].map((mark) => mark.className),
      }))
    );
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openApp(page);
  await configureValidInputs(page);
  await selectMode(page, 'contest');
  await page.locator('#cqButton').click();
  await releaseAudio(page);
  await page.locator('#responseField').fill('K0A');
  await page.locator('#sendButton').click();
  await releaseAudio(page);
  await page.locator('#infoField').fill('01');
  await page.locator('#tuButton').click();
  await expect(results).toHaveCount(1);
  const completedResult = await readResult(results.first());
  expect(completedResult[0].text).toBe('1');
  expect(completedResult[5]).toEqual({
    text: '1',
    scoringClasses: ['text-success'],
  });

  await releaseAudio(page);
  await page.locator('#responseField').fill('K0A');
  await page.locator('#sendButton').click();
  await releaseAudio(page);
  await page.locator('#agnButton').click();
  await page.locator('#infoField').fill('01');
  await page.locator('#stopButton').click();

  await expect(page.locator('#activeStations')).toHaveText('0');
  await expect(page.locator('#responseField')).toHaveValue('');
  await expect(page.locator('#infoField')).toHaveValue('');
  await expect(page.locator('#infoField2')).toHaveValue('');
  await expect(page.locator('#agnButton')).toBeDisabled();
  await expect(results).toHaveCount(1);
  expect(await readResult(results.first())).toEqual(completedResult);
  const stoppedContexts = await audioContextSnapshots(page);

  await page.locator('#responseField').fill('K0A');
  await page.locator('#sendButton').click();
  await page.locator('#responseField').press('Enter');
  await page.locator('#agnButton').evaluate((button) => button.click());
  await page.locator('#tuButton').click();
  await page.locator('#infoField').fill('01');
  await page.locator('#infoField').press('Enter');

  expect(await audioContextSnapshots(page)).toEqual(stoppedContexts);
  await expect(results).toHaveCount(1);
  expect(await readResult(results.first())).toEqual(completedResult);
  await expect(page.locator('#activeStations')).toHaveText('0');
  expect(errors).toEqual([]);

  // Restart without advancing the replacement context's zero clock.
  await page.locator('#cqButton').click();
  await expect(page.locator('#activeStations')).toHaveText('1');
  expect((await audioContextSnapshots(page)).at(-1).oscillators).toBe(2);
  await releaseAudio(page);
  await page.locator('#responseField').fill('K0A');
  await page.locator('#sendButton').click();
  await releaseAudio(page);
  await page.locator('#infoField').fill('');
  await page.locator('#agnButton').click();
  await releaseAudio(page);
  await page.locator('#infoField').fill('01');
  await setRandom(page, 0.9);
  await page.locator('#tuButton').click();

  await expect(results).toHaveCount(2);
  const latestCells = results.first().locator('td');
  await expect(latestCells.nth(0)).toHaveText('2');
  await expect(latestCells.nth(3)).toHaveText('2');
  await expect(latestCells.nth(5)).toHaveText('1 (1 AGN)');
  await expect(latestCells.nth(5).locator('.text-success')).toHaveCount(1);
  await expect(latestCells.nth(5).locator('.text-warning')).toHaveCount(0);
  expect(await readResult(results.nth(1))).toEqual(completedResult);
  expect(errors).toEqual([]);
});

test('Stop keeps invalid restarts silent and allows empty Send to start a validated session', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openApp(page);
  await configureValidInputs(page);
  await selectMode(page, 'contest');
  await page.locator('#cqButton').click();
  await releaseAudio(page);
  await page.locator('#responseField').fill('K0A');
  await page.locator('#sendButton').click();
  await page.locator('#stopButton').click();
  await expect(page.locator('#activeStations')).toHaveText('0');
  const stoppedContexts = await audioContextSnapshots(page);

  await page.locator('#yourCallsign').fill('');
  await page.locator('#cqButton').click();
  await expect(page.locator('#yourCallsign')).toHaveClass(/is-invalid/);
  await page.locator('#responseField').fill('');
  await page.locator('#sendButton').click();
  expect(await audioContextSnapshots(page)).toEqual(stoppedContexts);
  await expect(page.locator('#activeStations')).toHaveText('0');
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);

  await page.locator('#yourCallsign').fill('W1AW');
  await page.locator('#sendButton').click();
  await expect(page.locator('#activeStations')).toHaveText('1');
  await expect(page.locator('#yourCallsign')).not.toHaveClass(/is-invalid/);
  const restartedContexts = await audioContextSnapshots(page);
  expect(restartedContexts.slice(0, -1)).toEqual(stoppedContexts.slice(0, -1));
  expect(restartedContexts.at(-1)).toMatchObject({
    currentTime: 0,
    oscillators: 2,
  });
  expect(restartedContexts.at(-1).scheduledEvents).toBeGreaterThan(0);
  expect(restartedContexts.at(-1).lastScheduledTime).toBeLessThan(100);
  expect(errors).toEqual([]);
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

test('storage failures at the localStorage getter still allow default startup and Single practice', async ({
  page,
}) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new globalThis.DOMException(
          'Storage access blocked',
          'SecurityError'
        );
      },
    });
  });
  await openApp(page);
  await expect(page.locator('#modeSingle')).toBeChecked();
  expect(await practicePreferencesSnapshot(page)).toEqual({
    responding: defaultRespondingPreferences,
    effects: defaultEffectsPreferences,
  });
  await expect(page.locator('#farnsworthSpeed')).toBeDisabled();
  await expect(page.locator('#cutA')).toBeDisabled();
  await expect(page.locator('#qsbPercentage')).toBeDisabled();
  expect(pageErrors).toEqual([]);

  await configureValidInputs(page, { yourCallsign: 'W1AW', yourSpeed: '24' });
  await expect(page.locator('#yourCallsign')).toHaveValue('W1AW');
  await expect(page.locator('#yourSpeed')).toHaveValue('24');
  await page.locator('#cqButton').click();
  await expect(page.locator('#activeStations')).toHaveText('1');
  const afterCq = await audioSnapshot(page);
  expect(afterCq.oscillators).toBe(2);
  expect(afterCq.scheduledEvents).toBeGreaterThan(0);

  await releaseAudio(page);
  await page.locator('#responseField').fill('K0A');
  await page.locator('#sendButton').click();
  const rows = page.locator('#resultsTable tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first().locator('td').nth(1)).toHaveText('K0A');
  await expect(rows.first().locator('td').nth(2)).toHaveText('18');
  await expect(rows.first().locator('td').nth(3)).toHaveText('1');
  await expect(page.locator('#activeStations')).toHaveText('1');
  const completed = await audioSnapshot(page);
  expect(completed.oscillators).toBe(afterCq.oscillators + 1);
  expect(completed.scheduledEvents).toBeGreaterThan(afterCq.scheduledEvents);
  expect(pageErrors).toEqual([]);
});

test('storage failures after startup preserve edits, mode changes, Defaults, and Field Day practice', async ({
  page,
}) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await openApp(page);
  await configureValidInputs(page);
  await page.locator('#cqButton').click();
  await expect(page.locator('#activeStations')).toHaveText('1');
  await page.locator('#responseField').fill('stale');
  const oldContext = (await audioContextSnapshots(page)).find(
    (context) => context.state === 'running' && context.oscillators > 0
  );
  expect(pageErrors).toEqual([]);

  await page.evaluate(() => {
    globalThis.Storage.prototype.setItem = () => {
      throw new globalThis.DOMException(
        'Storage writes blocked',
        'QuotaExceededError'
      );
    };
    globalThis.Storage.prototype.removeItem = () => {
      throw new globalThis.DOMException(
        'Storage removal blocked',
        'SecurityError'
      );
    };
  });
  await page.locator('#yourCallsign').fill('W1AW');
  await page.locator('#yourFieldDayClass').fill('3A');
  await page.locator('#yourFieldDaySection').fill('CT');
  const customEffects = { ...customEffectsPreferences, qrn: 'off' };
  await setPracticePreferences(
    page,
    customRespondingPreferences,
    customEffects
  );
  expect(await practicePreferencesSnapshot(page)).toEqual({
    responding: customRespondingPreferences,
    effects: customEffects,
  });
  await expect(page.locator('#farnsworthSpeed')).toBeEnabled();
  await expect(page.locator('#cutA')).toBeEnabled();
  await expect(page.locator('#qsbPercentage')).toBeEnabled();
  await expect(page.locator('#qsbValue')).toHaveText('82%');

  await selectMode(page, 'fd');
  await expect(page.locator('#modeResultsHeader')).toHaveText(
    'Field Day Mode Results'
  );
  await expect(page.locator('#activeStations')).toHaveText('0');
  await expect(page.locator('#responseField')).toHaveValue('');
  await expect(page.locator('#infoField')).toHaveValue('');
  await expect(page.locator('#infoField2')).toHaveValue('');
  await expect(page.locator('#infoField')).toHaveAttribute(
    'placeholder',
    'Class'
  );
  await expect(page.locator('#infoField2')).toHaveAttribute(
    'placeholder',
    'Section'
  );
  await expect(page.locator('#infoField')).toBeVisible();
  await expect(page.locator('#infoField2')).toBeVisible();
  await expect(page.locator('#tuButton')).toBeVisible();
  await expect(page.locator('#agnButton')).toBeDisabled();
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
  expect(
    (await audioContextSnapshots(page)).find(({ id }) => id === oldContext.id)
      .state
  ).toBe('closed');

  const defaultsModal = page.locator('#settingsDefaultsModal');
  for (const group of ['Responding Station', 'Effects']) {
    await page
      .getByRole('button', { name: `Restore ${group} defaults` })
      .click();
    await expect(defaultsModal).toBeVisible();
    await defaultsModal
      .getByRole('button', { name: 'Restore defaults' })
      .click();
    await expect(defaultsModal).toBeHidden();
    expect(await practicePreferencesSnapshot(page)).toEqual({
      responding: defaultRespondingPreferences,
      effects: group === 'Effects' ? defaultEffectsPreferences : customEffects,
    });
  }
  await expect(page.locator('#farnsworthSpeed')).toBeDisabled();
  await expect(page.locator('#cutA')).toBeDisabled();
  await expect(page.locator('#qsbPercentage')).toBeDisabled();
  await expect(page.locator('#qsbValue')).toHaveText('50%');
  await expect(page.locator('#yourCallsign')).toHaveValue('W1AW');
  await expect(page.locator('#yourFieldDayClass')).toHaveValue('3A');
  await expect(page.locator('#yourFieldDaySection')).toHaveValue('CT');
  await expect(page.locator('#modeFieldDay')).toBeChecked();
  expect(pageErrors).toEqual([]);

  await configureValidInputs(page, {
    yourCallsign: 'W1AW',
    yourFieldDayClass: '3A',
    yourFieldDaySection: 'CT',
  });
  const beforeCq = await audioSnapshot(page);
  await page.locator('#cqButton').click();
  await expect(page.locator('#activeStations')).toHaveText('1');
  const afterCq = await audioSnapshot(page);
  expect(afterCq.oscillators).toBe(beforeCq.oscillators + 2);
  expect(afterCq.scheduledEvents).toBeGreaterThan(beforeCq.scheduledEvents);
  await releaseAudio(page);
  await page.locator('#responseField').fill('K0A');
  await page.locator('#sendButton').click();
  await expect(page.locator('#infoField')).toBeFocused();
  await releaseAudio(page);
  await page.locator('#infoField').fill('1D');
  await page.locator('#infoField2').fill('AL');
  await setRandom(page, 0.9);
  await page.locator('#tuButton').click();

  const rows = page.locator('#resultsTable tbody tr');
  await expect(rows).toHaveCount(1);
  const cells = rows.first().locator('td');
  await expect(cells.nth(1)).toHaveText('K0A');
  await expect(cells.nth(2)).toHaveText('18');
  await expect(cells.nth(3)).toHaveText('1');
  await expect(cells.nth(5)).toHaveText('1D / AL');
  await expect(page.locator('#activeStations')).toHaveText('0');
  expect((await audioSnapshot(page)).scheduledEvents).toBeGreaterThan(
    afterCq.scheduledEvents
  );
  expect(pageErrors).toEqual([]);
});

test('exponent-form settings preserve numeric playback and saved values across reload', async ({
  page,
}) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await openApp(page);
  await configureValidInputs(page, {
    yourSpeed: '0.5e2',
    yourSidetone: '6e2',
    minSpeed: '6e1',
    maxSpeed: '6e1',
    minTone: '4e2',
    maxTone: '4e2',
  });

  const expectTiming = (gain, speed, frequency) => {
    expect(gain.events.length).toBeGreaterThanOrEqual(12);
    expect(gain.events.every(({ time }) => Number.isFinite(time))).toBe(true);
    expect(gain.frequency).toBe(frequency);
    // Both the CQ's initial C and the caller's initial K start with dash-dot.
    // Each symbol has six events; event 4 is its nominal end.
    const dash = gain.events[4].time - gain.events[0].time;
    const dot = gain.events[10].time - gain.events[6].time;
    expect(dash).toBeCloseTo((3 * 1.2) / speed, 10);
    expect(dot).toBeCloseTo(1.2 / speed, 10);
    return { dash, dot, frequency: gain.frequency };
  };

  const completeContact = async () => {
    await page.locator('#cqButton').click();
    await expect(page.locator('#activeStations')).toHaveText('1');
    expect(pageErrors).toEqual([]);
    const gains = await page.evaluate(() =>
      globalThis.__morseTest.gainSnapshots()
    );
    expect(gains).toHaveLength(2);
    const timing = {
      operator: expectTiming(gains[0], 50, 600),
      caller: expectTiming(gains[1], 60, 400),
    };
    const afterCq = await audioSnapshot(page);
    expect(afterCq.bufferSources).toBe(0);

    await releaseAudio(page);
    await page.locator('#responseField').fill('K0A');
    await page.locator('#sendButton').click();
    const rows = page.locator('#resultsTable tbody tr');
    await expect(rows).toHaveCount(1);
    const cells = rows.first().locator('td');
    await expect(cells.nth(1)).toHaveText('K0A');
    await expect(cells.nth(2)).toHaveText('60');
    await expect(cells.nth(3)).toHaveText('1');
    await expect(page.locator('#activeStations')).toHaveText('1');
    await expect(page.locator('#responseField')).toHaveValue('');
    const afterContact = await audioSnapshot(page);
    expect(afterContact.oscillators).toBe(afterCq.oscillators + 1);
    expect(afterContact.scheduledEvents).toBeGreaterThan(
      afterCq.scheduledEvents
    );
    const nextCaller = await page.evaluate(() =>
      globalThis.__morseTest.gainSnapshots().at(-1)
    );
    expectTiming(nextCaller, 60, 400);
    expect(pageErrors).toEqual([]);
    return timing;
  };

  const initialTiming = await completeContact();
  const stored = await page.evaluate(() => ({
    yourSpeed: localStorage.getItem('yourSpeed'),
    yourSidetone: localStorage.getItem('yourSidetone'),
    responding: JSON.parse(
      localStorage.getItem('morsewalker.preferences.respondingStation')
    ),
  }));
  expect(stored).toMatchObject({
    yourSpeed: '0.5e2',
    yourSidetone: '6e2',
    responding: {
      version: 1,
      values: {
        minSpeed: 60,
        maxSpeed: 60,
        minTone: 400,
        maxTone: 400,
      },
    },
  });

  await page.reload();
  await expect(page.locator('#modeResultsHeader')).toHaveText(
    'Single Mode Results'
  );
  await expect(page.locator('#yourSpeed')).toHaveValue('0.5e2');
  await expect(page.locator('#yourSidetone')).toHaveValue('6e2');
  for (const id of ['minSpeed', 'maxSpeed']) {
    await expect(page.locator(`#${id}`)).toHaveValue('60');
  }
  for (const id of ['minTone', 'maxTone']) {
    await expect(page.locator(`#${id}`)).toHaveValue('400');
  }
  expect(await completeContact()).toEqual(initialTiming);
  expect(pageErrors).toEqual([]);
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
    'Only Responding Station settings will be reset.'
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
    'Only Effects settings will be reset.'
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
