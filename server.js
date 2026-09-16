import { createServer } from 'http';
import { createHash } from 'crypto';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, relative, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { brotliCompressSync, gzipSync, constants } from 'zlib';

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
  const encodedAssets = new Map();
  return createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "base-uri 'self'; object-src 'none'; frame-ancestors 'self'");
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    if (!['GET', 'HEAD'].includes(req.method ?? 'GET')) {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
      res.end('Method not allowed');
      return;
    }
    const requestUrl = new URL(req.url ?? '/', 'http://localhost');
    const host = (req.headers.host ?? '').split(':')[0].toLowerCase();
    // CF-Visitor preserves the visitor's scheme across Cloudflare → Tunnel → Traefik.
    let visitorScheme;
    try { visitorScheme = JSON.parse(req.headers['cf-visitor'] ?? '{}').scheme; } catch { /* Fall back to proxy header. */ }
    const scheme = visitorScheme ?? req.headers['x-forwarded-proto']?.split(',')[0].trim();
    const publicHost = ['lucashenry.dev', 'www.lucashenry.dev'].includes(host);
    const forceOrigin = publicHost && (host.startsWith('www.') || scheme === 'http');
    let canonicalPath = requestUrl.pathname;
    if (canonicalPath === '/sitemap.xml' && existsSync(join(root, 'sitemap-index.xml'))) canonicalPath = '/sitemap-index.xml';
    const filePath = resolveRequestPath(root, canonicalPath);
    if (filePath?.endsWith(`${sep}index.html`)) {
      canonicalPath = `/${relative(resolve(root), filePath).split(sep).join('/').slice(0, -'index.html'.length)}`;
    }
    if (forceOrigin || canonicalPath !== requestUrl.pathname) {
      // Build the destination from a fixed origin to avoid protocol-relative redirects.
      const destination = new URL(`.${canonicalPath}`, 'https://lucashenry.dev/');
      destination.search = requestUrl.search;
      res.writeHead(308, { Location: publicHost ? destination.href : destination.pathname + destination.search });
      res.end();
      return;
    }

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
    const isHashedAsset = relativePath.startsWith('_astro/');
    const isMachineReadable = relativePath === 'llms.txt'
      || relativePath === 'notes/manifest.json'
      || relativePath.endsWith('/feed.xml')
      || relativePath.endsWith('/index.md');

    try {
      const content = readFileSync(filePath);
      const digest = createHash('sha256').update(content).digest('hex');
      const compressible = content.length >= 1024 && /^(text\/|application\/(javascript|json|xml|rss\+xml))/.test(contentType);
      const accepted = new Map((req.headers['accept-encoding'] ?? '').split(',').map((entry) => {
        const [name, ...parameters] = entry.trim().toLowerCase().split(';');
        const quality = parameters.find((parameter) => parameter.trim().startsWith('q='));
        return [name, quality ? Number(quality.trim().slice(2)) : 1];
      }));
      const encoding = compressible
        ? ['br', 'gzip'].find((name) => (accepted.get(name) ?? accepted.get('*') ?? 0) > 0)
        : undefined;
      let body = content;
      if (encoding) {
        const key = `${digest}:${encoding}`;
        if (!encodedAssets.has(key)) {
          if (encodedAssets.size >= 64) encodedAssets.delete(encodedAssets.keys().next().value);
          encodedAssets.set(key, encoding === 'br'
            ? brotliCompressSync(content, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } })
            : gzipSync(content));
        }
        body = encodedAssets.get(key);
      }
      const etag = `"${digest}${encoding ? `-${encoding}` : ''}"`;
      const headers = {
        'Content-Type': contentType,
        'Content-Length': body.length,
        ...(compressible ? { Vary: 'Accept-Encoding' } : {}),
        ...(encoding ? { 'Content-Encoding': encoding } : {}),
        ETag: etag,
        ...((isContentAddressedAsset || isHashedAsset)
          ? { 'Cache-Control': 'public, max-age=31536000, immutable' }
          : isMachineReadable
            ? { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' }
            : { 'Cache-Control': ext === '.html' ? 'public, max-age=0, must-revalidate, no-transform' : relativePath.startsWith('open-graph/v') ? 'public, max-age=0, must-revalidate' : 'public, max-age=3600' }),
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
      res.end(req.method === 'HEAD' ? undefined : body);
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
