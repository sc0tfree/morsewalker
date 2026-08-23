import { readFile } from 'node:fs/promises';

const indexUrl = new URL('../../src/index.html', import.meta.url);

export async function loadAppHtml() {
  const html = await readFile(indexUrl, 'utf8');
  document.open();
  document.write(html);
  document.close();
}
