import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createStaticServer } from '../../server.js';

test('static server serves browser and agent artifacts with correct HTTP semantics', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'portfolio-server-'));
  mkdirSync(join(root, 'es/notas/example'), { recursive: true });
  mkdirSync(join(root, 'notes'), { recursive: true });
  mkdirSync(join(root, 'images/notes/diagrams/example/visual'), { recursive: true });
  mkdirSync(join(root, 'open-graph/v4'), { recursive: true });
  writeFileSync(join(root, 'index.html'), '<h1>home</h1>');
  writeFileSync(join(root, 'es/notas/example/index.html'), '<h1>nota</h1>');
  writeFileSync(join(root, 'es/notas/example/index.md'), '# Nota\n');
  writeFileSync(join(root, 'es/notas/feed.xml'), '<rss></rss>');
  writeFileSync(join(root, 'llms.txt'), '# Index\n');
  writeFileSync(join(root, 'notes/manifest.json'), '{"schemaVersion":1}');
  writeFileSync(join(root, 'images/notes/diagrams/example/visual/es-012345abcdef.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  writeFileSync(join(root, 'open-graph/v4/home.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const server = createStaticServer(root);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;

  const nested = await fetch(`${base}/es/notas/example/?from=test`);
  assert.equal(nested.status, 200);
  assert.match(await nested.text(), /nota/);

  const markdown = await fetch(`${base}/es/notas/example/index.md`);
  assert.equal(markdown.headers.get('content-type'), 'text/markdown; charset=utf-8');
  assert.equal(markdown.headers.get('access-control-allow-origin'), '*');
  assert.equal(markdown.headers.get('link'), '<https://lucashenry.dev/es/notas/example/>; rel="canonical"');
  assert.match(markdown.headers.get('etag') ?? '', /^"[a-f0-9]{64}"$/);
  assert.match(await markdown.text(), /# Nota/);

  const conditional = await fetch(`${base}/es/notas/example/index.md`, {
    headers: { 'If-None-Match': markdown.headers.get('etag') ?? '' },
  });
  assert.equal(conditional.status, 304);
  assert.equal(await conditional.text(), '');

  const head = await fetch(`${base}/notes/manifest.json`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(head.headers.get('access-control-allow-origin'), '*');
  assert.equal(await head.text(), '');

  const feed = await fetch(`${base}/es/notas/feed.xml`);
  assert.equal(feed.headers.get('content-type'), 'application/rss+xml; charset=utf-8');

  const addressed = await fetch(`${base}/images/notes/diagrams/example/visual/es-012345abcdef.png`);
  assert.equal(addressed.headers.get('cache-control'), 'public, max-age=31536000, immutable');

  const compatibilityCard = await fetch(`${base}/open-graph/v4/home.png`);
  assert.equal(compatibilityCard.status, 200);
  assert.equal(compatibilityCard.headers.get('content-type'), 'image/png');
  assert.equal(compatibilityCard.headers.get('cache-control'), null);

  const unsupported = await fetch(`${base}/`, { method: 'POST' });
  assert.equal(unsupported.status, 405);
  assert.equal(unsupported.headers.get('allow'), 'GET, HEAD');

  const missing = await fetch(`${base}/definitely-missing`);
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), 'Not found');
});
