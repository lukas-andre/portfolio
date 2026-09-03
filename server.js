import { createServer } from 'http';
import { createHash } from 'crypto';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, relative, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 3000);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
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
    if (!['GET', 'HEAD'].includes(req.method ?? 'GET')) {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
      res.end('Method not allowed');
      return;
    }
    const filePath = resolveRequestPath(root, req.url);

    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = extname(filePath);
    let contentType = mimeTypes[ext] || 'application/octet-stream';
    const relativePath = relative(resolve(root), filePath).split(sep).join('/');
    if (relativePath.endsWith('/feed.xml')) contentType = 'application/rss+xml; charset=utf-8';
    const isContentAddressedAsset = /^open-graph\/notes\/.+\/[a-z]{2}-[a-f0-9]{12}\.png$/.test(relativePath)
      || /^images\/notes\/diagrams\/.+\/[a-z]{2}-[a-f0-9]{12}\.png$/.test(relativePath);
    const isMachineReadable = relativePath === 'llms.txt'
      || relativePath === 'notes/manifest.json'
      || relativePath.endsWith('/feed.xml')
      || relativePath.endsWith('/index.md');

    try {
      const content = readFileSync(filePath);
      const etag = `"${createHash('sha256').update(content).digest('hex')}"`;
      const headers = {
        'Content-Type': contentType,
        ETag: etag,
        ...(isContentAddressedAsset
          ? { 'Cache-Control': 'public, max-age=31536000, immutable' }
          : isMachineReadable
            ? { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' }
            : {}),
        ...(isMachineReadable ? { 'Access-Control-Allow-Origin': '*' } : {}),
        ...(relativePath.endsWith('/index.md') ? {
          Link: `<https://lucashenry.dev/${relativePath.slice(0, -'index.md'.length)}>; rel="canonical"`,
        } : {}),
      };
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, headers);
        res.end();
        return;
      }
      res.writeHead(200, headers);
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
