import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const indexPath = resolve(process.cwd(), 'src/index.html');

export async function loadAudioTestPage() {
  const html = await readFile(indexPath, 'utf8');
  document.open();
  document.write(html);
  document.close();
}
