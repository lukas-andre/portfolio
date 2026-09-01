import { expect, test, type Page } from '@playwright/test';

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test('home communicates the current role, scope, and honest agent-system states', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/');

  await expect(page.locator('.hero-roles')).toContainText('Tech Team Lead');
  await expect(page.locator('.hero-output')).toContainText('Customer & Seller Self Service');
  await expect(page.locator('.hero-output')).toContainText('7 capabilities · 3 teams · ~30 people');

  const agentSystem = page.locator('#ai');
  await agentSystem.scrollIntoViewIfNeeded();
  await expect(agentSystem.getByRole('heading', { level: 2 })).toContainText('Agent Operating System');
  await expect(agentSystem).toContainText('Herdr');
  await expect(agentSystem).toContainText('Oh My Pi');
  await expect(agentSystem).toContainText('Vercel AI SDK');
  await expect(agentSystem).toContainText('IN USE');
  await expect(agentSystem).toContainText('BUILDING');

  const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
  expect(jsonLd.jobTitle).toBe('Tech Team Lead — Customer & Seller Self Service');

  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://lucashenry.dev/open-graph/v3/home.png',
  );
  await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute('content', 'image/png');
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute('content', /Lucas Henry/);
  await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute('content', /Lucas Henry/);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('printable resume is sourced from the same profile and remains responsive', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/resume/');

  await expect(page.getByRole('heading', { level: 1, name: 'Lucas Henry' })).toBeVisible();
  await expect(page.getByText('Tech Team Lead · Customer & Seller Self Service · Agentic Systems')).toBeVisible();
  await expect(page.getByText('7', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Returns · Cancellations · My Purchases · My Cases · My Account')).toBeVisible();
  await expect(page.getByText('CORPORATE COWORK · BUILDING')).toBeVisible();
  await expect(page.getByRole('button', { name: 'print / save PDF' })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
