import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
function option(name, fallback) {
  const direct = args.find(arg => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
}
const bindHost = option('host', process.env.HOST || '127.0.0.1');
const firstPort = Number(option('port', process.env.PORT || '4173'));
const strictPort = args.includes('--strictPort') || args.includes('--strict-port');
const serveRoot = resolve(projectRoot, option('dir', 'app'));
if (!Number.isInteger(firstPort) || firstPort < 1 || firstPort > 65535) throw new Error('Port must be an integer between 1 and 65535.');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4',
};
const server = http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }); response.end('Method not allowed'); return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://local.invalid').pathname);
    if (pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    let target = resolve(serveRoot, `.${pathname}`);
    if (target !== serveRoot && !target.startsWith(`${serveRoot}${sep}`)) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    let info = await stat(target);
    if (info.isDirectory()) { target = resolve(target, 'index.html'); info = await stat(target); }
    if (!info.isFile()) { response.writeHead(404); response.end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': mime[extname(target).toLowerCase()] || 'application/octet-stream', 'Content-Length': info.size });
    if (request.method === 'HEAD') { response.end(); return; }
    const stream = createReadStream(target);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  } catch (error) {
    response.writeHead(error instanceof URIError ? 400 : 404);
    response.end(error instanceof URIError ? 'Bad request' : 'Not found');
  }
});
let activePort = firstPort;
server.on('error', error => {
  if (error.code === 'EADDRINUSE' && !strictPort && activePort < Math.min(firstPort + 10, 65535)) {
    activePort += 1; server.listen(activePort, bindHost); return;
  }
  console.error(`Unable to serve on ${bindHost}:${activePort}: ${error.message}`);
  process.exitCode = 1;
});
server.on('listening', () => {
  const displayHost = bindHost === '0.0.0.0' ? 'localhost' : bindHost;
  console.log(`City Life is ready: http://${displayHost}:${activePort}/`);
  console.log(`Serving ${serveRoot}`);
});
server.listen(activePort, bindHost);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
