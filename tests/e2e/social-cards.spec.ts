import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';

const versionedCards = [
  '/open-graph/v4/home.png',
  '/open-graph/v4/en/notes/the-end-of-software-engineering.png',
  '/open-graph/v4/es/notas/el-fin-de-la-ingenieria-de-software.png',
];

const compatibilityCards = [
  '/og.png',
  '/open-graph/en/notes/the-end-of-software-engineering.png',
  '/open-graph/es/notas/el-fin-de-la-ingenieria-de-software.png',
];

test('social cards are distinct, cacheable 1200 × 630 PNG images', async ({ request }) => {
  const hashes: string[] = [];

  for (const route of versionedCards) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(200);
    expect(response.headers()['content-type'], route).toContain('image/png');
    expect(response.headers()['cache-control'], route).toContain('max-age=');

    const image = await response.body();
    expect(image.byteLength, route).toBeGreaterThan(20_000);

    const metadata = await sharp(image).metadata();
    expect(metadata.format, route).toBe('png');
    expect(metadata.width, route).toBe(1200);
    expect(metadata.height, route).toBe(630);
    hashes.push(createHash('sha256').update(image).digest('hex'));
  }

  expect(new Set(hashes).size).toBe(versionedCards.length);
});

test('legacy social-card URLs remain compatible', async ({ request }) => {
  for (const route of compatibilityCards) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(200);
    expect(response.headers()['content-type'], route).toContain('image/png');

    const metadata = await sharp(await response.body()).metadata();
    expect(metadata.width, route).toBeGreaterThanOrEqual(1200);
    expect(metadata.height, route).toBeGreaterThanOrEqual(630);
    expect(metadata.width! / metadata.height!, route).toBeCloseTo(1200 / 630, 3);
  }
});
