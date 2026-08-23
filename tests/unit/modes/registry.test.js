/* @vitest-environment jsdom */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

let modes;
let modeIds;
let getMode;
let modeUIConfig;
let modeLogicConfig;

async function loadAppHtml() {
  const html = await readFile(resolve(process.cwd(), 'src/index.html'), 'utf8');
  document.open();
  document.write(html);
  document.close();
}

function modeRadios() {
  return [...document.querySelectorAll('input[name="mode"]')];
}

beforeAll(async () => {
  await loadAppHtml();
  ({ modes, modeIds, getMode, modeUIConfig, modeLogicConfig } = await import(
    '../../../src/js/modes/index.js'
  ));
});

describe('mode registry', () => {
  it('keys both derived config maps by the registered ids', () => {
    expect(Object.keys(modeUIConfig)).toEqual(modeIds);
    expect(Object.keys(modeLogicConfig)).toEqual(modeIds);
  });

  it('looks up each registered mode by id and nothing else', () => {
    for (const mode of modes) {
      expect(getMode(mode.id)).toBe(mode);
    }

    expect(getMode('nonexistent')).toBeUndefined();
  });

  // The mode radio buttons are hand-written in index.html, so this is what
  // catches a mode being registered without a button, or vice versa.
  it('matches the mode buttons in index.html, in order', () => {
    expect(modeRadios().map((radio) => radio.value)).toEqual(modeIds);
  });

  it('matches the mode button labels in index.html', () => {
    const labels = modeRadios().map((radio) =>
      document.querySelector(`label[for="${radio.id}"]`).textContent.trim()
    );

    expect(labels).toEqual(modes.map((mode) => mode.label));
  });
});
