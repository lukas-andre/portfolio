import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';

test('content-addressed article cards are distinct immutable 1200 × 630 PNGs', async ({ page, request }) => {
  const routes = [
    '/es/notas/el-fin-de-la-ingenieria-de-software/',
    '/en/notes/the-end-of-software-engineering/',
    '/es/notas/deja-de-estorbarle-a-tu-ia/',
    '/en/notes/stop-hobbling-your-ai/',
  ];
  const hashes = new Set<string>();

  for (const route of routes) {
    await page.goto(route);
    const cardUrl = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(cardUrl, route).toMatch(/\/open-graph\/notes\/.+\/[a-z]{2}-[a-f0-9]{12}\.png$/);
    const response = await request.get(new URL(cardUrl!).pathname);
    expect(response.status(), route).toBe(200);
    expect(response.headers()['content-type'], route).toContain('image/png');
    expect(response.headers()['cache-control'], route).toContain('max-age=31536000');
    expect(response.headers()['cache-control'], route).toContain('immutable');

    const image = await response.body();
    expect(image.byteLength, route).toBeGreaterThan(20_000);
    const metadata = await sharp(image).metadata();
    expect(metadata.format, route).toBe('png');
    expect(metadata.width, route).toBe(1200);
    expect(metadata.height, route).toBe(630);
    hashes.add(createHash('sha256').update(image).digest('hex'));
  }
  expect(hashes.size).toBe(routes.length);
});

test('legacy profile and article card aliases remain compatible but revalidatable', async ({ request }) => {
  for (const route of [
    '/og.png',
    '/open-graph/v4/home.png',
    '/open-graph/v4/en/notes/the-end-of-software-engineering.png',
    '/open-graph/v4/es/notas/el-fin-de-la-ingenieria-de-software.png',
  ]) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(200);
    expect(response.headers()['content-type'], route).toContain('image/png');
    if (route !== '/og.png') expect(response.headers()['cache-control'], route).toContain('must-revalidate');
    const metadata = await sharp(await response.body()).metadata();
    expect(metadata.width, route).toBeGreaterThanOrEqual(1200);
    expect(metadata.height, route).toBeGreaterThanOrEqual(630);
  }
});
