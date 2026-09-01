import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 3000);

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveRequestPath(root, requestUrl = '/') {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }

  if (pathname.includes('\0')) return null;

  const resolvedRoot = resolve(root);
  const requested = resolve(resolvedRoot, `.${pathname}`);
  if (requested !== resolvedRoot && !requested.startsWith(`${resolvedRoot}${sep}`)) return null;

  const candidates = pathname === '/'
    ? [join(resolvedRoot, 'index.html')]
    : [requested, `${requested}.html`, join(requested, 'index.html')];

  return candidates.find((candidate) => {
    try {
      return existsSync(candidate) && statSync(candidate).isFile();
    } catch {
      return false;
    }
  }) ?? null;
}

export function createStaticServer(root = distDir) {
  return createServer((req, res) => {
    const filePath = resolveRequestPath(root, req.url);

    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    try {
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': `${contentType}${contentType.startsWith('text/') ? '; charset=utf-8' : ''}` });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  });
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  createStaticServer().listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
