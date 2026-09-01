import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createStaticServer } from '../../server.js';

test('static server resolves nested Astro routes and returns real 404s', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'portfolio-server-'));
  mkdirSync(join(root, 'es/notas'), { recursive: true });
  mkdirSync(join(root, 'open-graph/v4'), { recursive: true });
  writeFileSync(join(root, 'index.html'), '<h1>home</h1>');
  writeFileSync(join(root, 'es/notas/index.html'), '<h1>notas</h1>');
  writeFileSync(join(root, 'open-graph/v4/home.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const server = createStaticServer(root);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;

  const nested = await fetch(`${base}/es/notas/?from=test`);
  assert.equal(nested.status, 200);
  assert.match(await nested.text(), /notas/);

  const socialCard = await fetch(`${base}/open-graph/v4/home.png`);
  assert.equal(socialCard.status, 200);
  assert.equal(socialCard.headers.get('content-type'), 'image/png');
  assert.equal(socialCard.headers.get('cache-control'), 'public, max-age=31536000, immutable');

  const missing = await fetch(`${base}/definitely-missing`);
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), 'Not found');
});
