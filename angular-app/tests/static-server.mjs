// Small static server for E2E tests, including the GitHub Pages repository subpath.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve(process.env.E2E_DIST ?? 'dist/nexo-informes/browser');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    pathname = pathname.replace(/^\/INFORMES_QUISCOS(?=\/|$)/, '');
    if (pathname === '' || pathname === '/') pathname = '/index.html';
    const file = resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    const bytes = await readFile(file);
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*' });
    response.end(bytes);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('E2E static server on http://127.0.0.1:4173/INFORMES_QUISCOS/'));
