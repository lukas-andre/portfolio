import { expect, test } from '@playwright/test';

test('light is the default and the theme persists across the full portfolio', async ({ page }) => {
  await page.goto('/es/notas/');

  const root = page.locator('html');
  const toggle = page.getByRole('button', { name: 'Cambiar a tema oscuro' });
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f3f0e8');
  await expect.poll(() => root.evaluate((node) => getComputedStyle(node).getPropertyValue('--bg-void').trim())).toBe('#f3f0e8');

  await toggle.click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Cambiar a tema claro' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0d0d0b');
  expect(await page.evaluate(() => localStorage.getItem('lucas-color-theme'))).toBe('dark');

  await page.goto('/');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => root.evaluate((node) => getComputedStyle(node).getPropertyValue('--bg-void').trim())).toBe('#0d0d0b');
  await expect(page.getByRole('complementary', { name: 'Latest research note' })).toBeVisible();

  const homeToggle = page.getByRole('button', { name: 'Switch to light theme' });
  await expect(homeToggle).toHaveAttribute('aria-pressed', 'true');
  await homeToggle.click();
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('complementary', { name: 'Latest research note' })).toBeVisible();

  await page.goto('/en/notes/the-end-of-software-engineering/');
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toHaveAttribute('aria-pressed', 'false');
});
