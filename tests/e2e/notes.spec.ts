import { expect, test, type Page } from '@playwright/test';

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test('home hero promotes the latest published note in both languages', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/');

  const latest = page.getByRole('complementary', { name: 'Latest research note' });
  await expect(latest).toBeVisible();
  await expect(latest.getByRole('heading', { level: 2 })).toHaveText('The End of Software Engineering? Not Quite.');
  await expect(latest.getByRole('link', { name: /Read research note:/ })).toHaveAttribute(
    'href',
    '/en/notes/the-end-of-software-engineering/',
  );
  await expect(latest.getByRole('link', { name: 'Leer esta nota en español' })).toHaveAttribute(
    'href',
    '/es/notas/el-fin-de-la-ingenieria-de-software/',
  );
  await expect(latest).toContainText(/\d+ min read/);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('Spanish notes index opens the published article', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/es/notas/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', { level: 1, name: 'Notas para entender lo que cambia.' })).toBeVisible();
  const article = page.getByRole('link', { name: '¿El fin de la ingeniería de software? No exactamente.' });
  await expect(article).toBeVisible();
  await article.click();
  await expect(page).toHaveURL(/\/es\/notas\/el-fin-de-la-ingenieria-de-software\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('No exactamente');
  expect(errors).toEqual([]);
});

test('localized article metadata and language switch are correct', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/es/notas/el-fin-de-la-ingenieria-de-software/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://lucashenry.dev/es/notas/el-fin-de-la-ingenieria-de-software/');
  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', 'https://lucashenry.dev/en/notes/the-end-of-software-engineering/');
  await expect(page.getByRole('link', { name: 'Read in English' })).toHaveAttribute('href', '/en/notes/the-end-of-software-engineering/');
  const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
  expect(JSON.parse(jsonLd ?? '{}')['@type']).toBe('BlogPosting');
  await expect(page.locator('.note-figure img')).toHaveCount(4);
  for (const image of await page.locator('.note-figure img').all()) {
    await expect(image).not.toHaveAttribute('alt', '');
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((node) => {
      const renderedImage = node as HTMLImageElement;
      return renderedImage.complete && renderedImage.naturalWidth > 0;
    })).toBe(true);
  }
  await expect(page.getByText(/asistencia de IA/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('English adaptation links back to Spanish', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/en/notes/the-end-of-software-engineering/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1, name: 'The End of Software Engineering? Not Quite.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Leer en español' })).toHaveAttribute('href', '/es/notas/el-fin-de-la-ingenieria-de-software/');
  await expect(page.getByText(/researched and drafted with AI assistance/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('article has no horizontal overflow at the active viewport', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/es/notas/el-fin-de-la-ingenieria-de-software/');
  await expect(page.getByRole('navigation', { name: 'Navegación de notas' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('localized diagrams, share cards, and missing routes behave correctly', async ({ page, request }) => {
  for (const route of [
    '/es/notas/el-fin-de-la-ingenieria-de-software/',
    '/en/notes/the-end-of-software-engineering/',
  ]) {
    await page.goto(route);
    const diagrams = page.locator('.note-figure img');
    await expect(diagrams).toHaveCount(4);
    for (const diagram of await diagrams.all()) {
      await diagram.scrollIntoViewIfNeeded();
      await expect.poll(() => diagram.evaluate((node) => {
        const renderedImage = node as HTMLImageElement;
        return renderedImage.complete && renderedImage.naturalWidth > 0;
      })).toBe(true);
    }

    const shareCard = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(shareCard).toBeTruthy();
    expect(shareCard).toContain('/open-graph/v2/');
    await expect(page.locator('meta[property="og:image:alt"]')).not.toHaveAttribute('content', '');
    await expect(page.locator('meta[name="twitter:image:alt"]')).not.toHaveAttribute('content', '');
    const response = await request.get(new URL(shareCard!).pathname);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
  }

  const missing = await request.get('/__paper-notes-smoke-test-missing__');
  expect(missing.status()).toBe(404);
});
