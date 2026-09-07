import { expect, test } from '@playwright/test';

const editions = [
  { lang: 'es', route: '/es/notas/deja-de-estorbarle-a-tu-ia/', title: 'Deja de estorbarle a tu IA', copy: 'Copiar enlace', copied: 'Enlace copiado', network: 'Compartir en LinkedIn' },
  { lang: 'en', route: '/en/notes/stop-hobbling-your-ai/', title: 'Stop Hobbling Your AI', copy: 'Copy link', copied: 'Link copied', network: 'Share on LinkedIn' },
];

for (const edition of editions) {
  test(`${edition.lang}: fallback links and clipboard use the canonical localized URL`, async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }));
    await page.goto(`${edition.route}?utm_source=test#article-body`);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const groups = page.locator('.note-share');
    await expect(groups).toHaveCount(2);
    for (const group of await groups.all()) {
      const trigger = group.locator('summary');
      await trigger.click();
      const linkedin = group.getByRole('link', { name: edition.network });
      await expect(linkedin).toBeVisible();
      const href = new URL((await linkedin.getAttribute('href'))!);
      expect(href.origin + href.pathname).toBe('https://www.linkedin.com/sharing/share-offsite/');
      expect(href.searchParams.get('url')).toBe(`https://lucashenry.dev${edition.route}`);
      const email = new URL((await group.locator('a[href^="mailto:"]').getAttribute('href'))!);
      expect(email.searchParams.get('subject')).toBe(edition.title);
      expect(email.searchParams.get('body')).toBe(`https://lucashenry.dev${edition.route}`);
      await trigger.press('Escape');
      await expect(linkedin).toBeHidden();
      await group.getByRole('button', { name: edition.copy, exact: true }).click();
      await expect(group.getByRole('button', { name: edition.copied, exact: true })).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`https://lucashenry.dev${edition.route}`);
    }
    expect(new URL(page.url()).search).toBe('?utm_source=test');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test('native sharing passes title and URL; cancellation is silent and other errors reveal alternatives', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as Window & { __sharePayload?: ShareData; __shareError?: string };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => {
      state.__sharePayload = data;
      if (state.__shareError) throw new DOMException('Simulated share outcome', state.__shareError);
    } });
  });
  await page.goto(editions[0].route);
  const group = page.locator('.note-share').first();
  await group.locator('summary').click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __sharePayload?: ShareData }).__sharePayload)).toEqual({ title: editions[0].title, url: `https://lucashenry.dev${editions[0].route}` });
  await page.evaluate(() => { (window as Window & { __shareError?: string }).__shareError = 'AbortError'; });
  await group.locator('summary').click();
  await expect(group.locator('details')).not.toHaveAttribute('open', '');
  await expect(group.getByRole('status')).toBeEmpty();
  await page.evaluate(() => { (window as Window & { __shareError?: string }).__shareError = 'NotAllowedError'; });
  await group.locator('summary').click();
  await expect(group.getByRole('link', { name: editions[0].network })).toBeVisible();
  await expect(page).toHaveURL(editions[0].route);
});

test('denied clipboard falls back without navigation, and failed fallback gives honest feedback', async ({ page }) => {
  await page.goto(editions[0].route);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) } });
    document.execCommand = () => {
      (window as Window & { __copied?: string }).__copied = (document.activeElement as HTMLTextAreaElement).value;
      return true;
    };
  });
  const group = page.locator('.note-share').first();
  const button = group.getByRole('button');
  await button.click();
  await expect(button).toHaveText(editions[0].copied);
  expect(await page.evaluate(() => (window as Window & { __copied?: string }).__copied)).toBe(`https://lucashenry.dev${editions[0].route}`);
  await expect(page).toHaveURL(editions[0].route);
  await expect(page.locator('body > textarea')).toHaveCount(0);
  await expect(button).toBeFocused();
  await page.evaluate(() => { document.execCommand = () => false; });
  await button.click();
  await expect(button).toHaveText('No se pudo copiar');
  await expect(group.getByRole('status')).toHaveText('No se pudo copiar');
  await expect(page).toHaveURL(editions[0].route);
});

test('sharing works without JavaScript through ordinary links', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto(editions[0].route);
  const group = page.locator('.note-share').first();
  await group.locator('summary').click();
  await expect(group.getByRole('link', { name: editions[0].network })).toBeVisible();
  await expect(group.locator('button')).toBeHidden();
  await context.close();
});


test('each published article links to its own LinkedIn discussion in both languages', async ({ page }) => {
  const discussions = [
    { routes: ['/es/notas/deja-de-estorbarle-a-tu-ia/', '/en/notes/stop-hobbling-your-ai/'], url: 'https://www.linkedin.com/feed/update/urn:li:activity:7502754179820457985/' },
    { routes: ['/es/notas/el-fin-de-la-ingenieria-de-software/', '/en/notes/the-end-of-software-engineering/'], url: 'https://www.linkedin.com/feed/update/urn:li:activity:7501377571666956288/' },
  ];
  for (const discussion of discussions) {
    for (const route of discussion.routes) {
      await page.goto(route);
      const label = route.startsWith('/es/') ? 'Conversar sobre este artículo en LinkedIn' : 'Discuss this article on LinkedIn';
      const link = page.getByRole('link', { name: label });
      await expect(link).toHaveCount(1);
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', discussion.url);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    }
  }
});
