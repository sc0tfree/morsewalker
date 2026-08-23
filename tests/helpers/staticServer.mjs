import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const port = Number(process.env.PORT ?? 4173);
const root = resolve('dist');
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

createServer(async (request, response) => {
  const requestUrl = new URL(
    request.url ?? '/',
    `http://${request.headers.host}`
  );
  const pathname = decodeURIComponent(requestUrl.pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = resolve(root, relativePath);

  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      throw new Error('Not a file');
    }

    response.writeHead(200, {
      'Content-Type':
        mimeTypes[extname(filePath)] ?? 'application/octet-stream',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving dist at http://127.0.0.1:${port}`);
});
