import { expect, test, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import matter from 'gray-matter';

// Read declared lifecycle state independently of the application's index builders.
const publicationDir = new URL('../../src/content/publications/', import.meta.url);
const publications = readdirSync(publicationDir).filter((file) => file.endsWith('.json')).map((file) => ({
  id: file.slice(0, -5),
  ...JSON.parse(readFileSync(new URL(file, publicationDir), 'utf8')),
}));
const published = publications.filter((work) => work.visibility === 'published');
const newest = [...published].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0];
const newestTitle = matter(readFileSync(new URL(`../../src/content/notes/en/${newest.editions.en.slug}.mdx`, import.meta.url), 'utf8')).data.title;


function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test('home promotes the latest published note with a thumbnail derived from its artwork', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/');

  const latest = page.getByRole('complementary', { name: 'Latest research note' });
  await expect(latest).toBeVisible();
  await expect(latest.getByRole('heading', { level: 2 })).toHaveText(newestTitle);
  await expect(latest.getByRole('link', { name: /Read research note:/ })).toHaveAttribute('href', `/en/notes/${newest.editions.en.slug}/`);
  await expect(latest.getByRole('link', { name: 'Leer esta nota en español' })).toHaveAttribute('href', `/es/notas/${newest.editions.es.slug}/`);
  const thumbnail = latest.locator('img');
  await expect(thumbnail).toHaveAttribute('src', /\/images\/notes\/diagrams\/.+\/en-[a-f0-9]{12}\.png$/);
  await expect(thumbnail).not.toHaveAttribute('alt', '');

  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('published article exposes curated SVG diagrams, localized metadata, and portable Mermaid', async ({ page, request }) => {
  const errors = collectRuntimeErrors(page);
  const route = '/es/notas/el-fin-de-la-ingenieria-de-software/';
  await page.goto(route);

  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://lucashenry.dev${route}`);
  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', 'https://lucashenry.dev/en/notes/the-end-of-software-engineering/');
  await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveAttribute('href', `https://lucashenry.dev${route}index.md`);
  await expect(page.locator('link[rel="describedby"]')).toHaveAttribute('href', 'https://lucashenry.dev/llms.txt');

  const jsonLd = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '{}');
  expect(jsonLd['@type']).toBe('BlogPosting');
  expect(jsonLd['@id']).toBe(`https://lucashenry.dev${route}#article`);
  expect(jsonLd.citation).toContain('https://arxiv.org/html/2606.05608v1');

  const figures = page.locator('.note-diagram');
  await expect(figures).toHaveCount(4);
  await expect(figures.locator('img')).toHaveCount(4);
  await expect(figures.locator('.diagram-copy-button')).toHaveCount(4);
  await expect(figures.locator('a[download]')).toHaveCount(8);
  for (const figure of await figures.all()) {
    await expect(figure).toHaveAttribute('data-diagram-id', /.+\/.+/);
    await figure.scrollIntoViewIfNeeded();
    await expect(figure.locator('img')).toBeVisible();
    const svg = await figure.locator('a[download][href$=".svg"]').getAttribute('href');
    const png = await figure.locator('a[download][href$=".png"]').getAttribute('href');
    expect(svg).toMatch(/^\/images\/notes\/.+\/es\/.+\.svg$/);
    expect(png).toMatch(/^\/images\/notes\/diagrams\/.+\/es-[a-f0-9]{12}\.png$/);
    expect((await request.get(svg!)).status()).toBe(200);
    expect((await request.get(png!)).status()).toBe(200);
  }

  const markdownLink = page.getByRole('link', { name: 'Ver .md' });
  await expect(markdownLink).toHaveAttribute('href', `${route}index.md`);
  const markdownResponse = await request.get(`${route}index.md`);
  expect(markdownResponse.status()).toBe(200);
  expect(markdownResponse.headers()['content-type']).toContain('text/markdown');
  const markdown = await markdownResponse.text();
  expect(markdown).toContain('translationKey: end-of-software-engineering');
  expect(markdown).toContain('Claims relacionados: `claim-01`');
  expect(markdown).toContain('https://lucashenry.dev/images/notes/diagrams/');
  expect(markdown).toContain('```mermaid');
  expect(markdown).toContain('look: handDrawn');
  expect(markdown).not.toContain('<NoteFigure');
  expect(markdown).not.toContain('/Users/');

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const copyArticle = page.locator('.note-copy-markdown');
  await copyArticle.click();
  await expect(copyArticle).toContainText('Markdown copiado');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('# ¿El fin de la ingeniería de software?');

  const copyDiagram = figures.first().locator('.diagram-copy-button');
  await copyDiagram.click();
  await expect(copyDiagram).toContainText('Mermaid copiado');
  const copiedDiagram = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedDiagram).toContain('```mermaid');
  expect(copiedDiagram).toContain('look: handDrawn');
  expect(copiedDiagram).toContain('flowchart LR');

  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('Copy Markdown falls back to a synchronous clipboard write without navigating away', async ({ page }) => {
  const route = '/es/notas/el-fin-de-la-ingenieria-de-software/';
  await page.goto(route);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new DOMException('blocked', 'NotAllowedError')) },
    });
    (window as Window & { __fallbackCopy?: string }).__fallbackCopy = '';
    document.execCommand = () => {
      const active = document.activeElement;
      (window as Window & { __fallbackCopy?: string }).__fallbackCopy = active instanceof HTMLTextAreaElement ? active.value : '';
      return true;
    };
  });

  const copy = page.locator('.note-copy-markdown');
  await copy.click();
  await expect(copy).toContainText('Markdown copiado');
  expect(await page.evaluate(() => (window as Window & { __fallbackCopy?: string }).__fallbackCopy)).toContain('# ¿El fin de la ingeniería de software?');
  expect(new URL(page.url()).pathname).toBe(route);
});

test('every visible note is paired, reflows without overflow, and keeps drafts out of search', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/es/notas/');
  const routes = await page.locator('.note-card h2 a').evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).getAttribute('href')).filter(Boolean) as string[]);
  expect(routes.length).toBeGreaterThan(1);

  for (const route of routes) {
    await page.goto(route);
    const figures = page.locator('.note-diagram');
    const count = await figures.count();
    expect(count, route).toBeGreaterThanOrEqual(2);
    expect(count, route).toBeLessThanOrEqual(4);
    await expect(page.getByRole('link', { name: 'Read in English' })).toHaveAttribute('href', /^\/en\/notes\//);
    await expect(page.getByRole('button', { name: 'Copiar Markdown' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver .md' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), route).toBeLessThanOrEqual(1);

    const draft = (await page.locator('.note-header__draft').count()) > 0;
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', draft ? 'noindex, nofollow' : 'index, follow');
  }
  expect(errors).toEqual([]);
});

test('machine indexes expose published work only', async ({ request }) => {
  const [llmsResponse, manifestResponse, esFeedResponse, enFeedResponse] = await Promise.all([
    request.get('/llms.txt'),
    request.get('/notes/manifest.json'),
    request.get('/es/notas/feed.xml'),
    request.get('/en/notes/feed.xml'),
  ]);

  expect(llmsResponse.headers()['content-type']).toContain('text/plain');
  expect(manifestResponse.headers()['content-type']).toContain('application/json');
  expect(esFeedResponse.headers()['content-type']).toContain('application/rss+xml');
  expect(enFeedResponse.headers()['content-type']).toContain('application/rss+xml');

  const llms = await llmsResponse.text();
  const feeds = { es: await esFeedResponse.text(), en: await enFeedResponse.text() };
  const manifest = await manifestResponse.json();
  expect(manifest.schemaVersion).toBe(1);
  expect(manifest.works.map((work: { id: string }) => work.id).sort()).toEqual(published.map((work) => work.id).sort());

  for (const work of publications) {
    for (const lang of ['es', 'en'] as const) {
      const slug = work.editions[lang].slug;
      const section = lang === 'es' ? 'notas' : 'notes';
      const route = `/${lang}/${section}/${slug}/`;
      if (work.visibility === 'published') {
        expect(llms).toContain(`${route}index.md`);
        expect(feeds[lang]).toContain(route);
      } else {
        expect(llms).not.toContain(route);
        expect(feeds[lang]).not.toContain(route);
      }
    }
  }
  for (const work of manifest.works) {
    expect(work.editions.es.markdown).toContain('/index.md');
    expect(work.diagrams.length).toBeGreaterThanOrEqual(2);
    expect(work.diagrams[0].claimRefs[0]).toMatch(/^claim-\d{2}$/);
    expect(work.diagrams[0].es.svg).toMatch(/\.svg$/);
    expect(work.diagrams[0].es.mermaid).toContain('look: handDrawn');
  }
});

test('unknown routes return a real 404', async ({ request }) => {
  expect((await request.get('/__paper-notes-smoke-test-missing__')).status()).toBe(404);
});
