import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { publishedSitemapEntries } from './seo/sitemap.mjs';

const base = (process.argv[2] ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const label = process.argv[3] ?? 'local';
const report = { base, checkedAt: new Date().toISOString(), pages: [], checks: [], errors: [] };
const paths = [...publishedSitemapEntries().keys()];
const browser = await chromium.launch({ channel: 'chrome', headless: false });
mkdirSync('artifacts', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().startsWith(base) && response.status() >= 400) report.errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  for (const path of paths) {
    const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    const metadata = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content,
      canonical: document.querySelector('link[rel="canonical"]')?.href,
      robots: document.querySelector('meta[name="robots"]')?.content,
      ogUrl: document.querySelector('meta[property="og:url"]')?.content,
      h1: document.querySelectorAll('h1').length,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      schema: JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent),
      alternates: [...document.querySelectorAll('link[hreflang]')].map((el) => ({ lang: el.hreflang, href: el.href })),
    }));
    assert.equal(metadata.canonical, `https://lucashenry.dev${path}`);
    assert.equal(metadata.ogUrl, metadata.canonical);
    assert.equal(metadata.robots, 'index, follow');
    assert.equal(metadata.h1, 1);
    assert.equal(metadata.overflow, false, path);
    assert.ok(metadata.title && metadata.description);
    assert.ok(response.headers()['cache-control'].includes('no-transform'));
    if (metadata.schema['@type'] === 'BlogPosting') {
      assert.equal(metadata.schema.author['@id'], 'https://lucashenry.dev/#lucas');
      assert.equal(metadata.schema.publisher['@id'], metadata.schema.author['@id']);
      assert.ok(metadata.schema.datePublished && metadata.schema.citation.length);
      assert.deepEqual(metadata.alternates.map((a) => a.lang), ['es', 'en', 'x-default']);
    }
    if (path === '/') {
      assert.equal(metadata.schema.mainEntity['@id'], 'https://lucashenry.dev/#lucas');
      assert.ok(await page.getByRole('link', { name: /Show · projects/ }).count());
      assert.equal(await page.locator('a[href*="/cdn-cgi/l/email-protection"]').count(), 0);
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 960 });
        await page.screenshot({ path: `artifacts/seo-${label}-home-${width}.png`, fullPage: true });
      }
      await page.setViewportSize({ width: 390, height: 844 });
    }
    report.pages.push({ path, status: response.status(), ...metadata });
  }
  const sitemap = await context.request.get(`${base}/sitemap-0.xml`);
  assert.equal(sitemap.status(), 200);
  const xml = await sitemap.text();
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(urls.sort(), paths.map((path) => `https://lucashenry.dev${path}`).sort());
  assert.ok(xml.includes('hreflang="es"') && xml.includes('hreflang="en"'));
  for (const [from, to] of [['/sitemap.xml', '/sitemap-index.xml'], ['/en/notes', '/en/notes/'], ['/en/notes/index.html', '/en/notes/']]) {
    const response = await context.request.get(`${base}${from}?audit=1`, { maxRedirects: 0 });
    assert.equal(response.status(), 308, from);
    assert.equal(new URL(response.headers().location, base).pathname, to);
    assert.equal(new URL(response.headers().location, base).search, '?audit=1');
  }
  const publications = new URL('../src/content/publications/', import.meta.url);
  for (const file of readdirSync(publications).filter((file) => file.endsWith('.json'))) {
    const work = JSON.parse(readFileSync(new URL(file, publications), 'utf8'));
    if (work.visibility === 'published') continue;
    for (const lang of ['es', 'en']) {
      const path = `/${lang}/${lang === 'es' ? 'notas' : 'notes'}/${work.editions[lang].slug}/`;
      assert.equal((await context.request.get(base + path)).status(), 404, `Unpublished work exposed: ${path}`);
    }
  }
  const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const plain = await nojs.newPage();
  await plain.goto(base);
  const hidden = await plain.locator('main h1, main h2, main h3').evaluateAll((headings) => headings.filter((heading) => {
    let element = heading;
    while (element) {
      const style = getComputedStyle(element);
      if (style.opacity === '0' || style.visibility === 'hidden' || style.display === 'none') return true;
      element = element.parentElement;
    }
    return false;
  }).map((heading) => heading.textContent));
  assert.deepEqual(hidden, []);
  report.checks.push({ sitemapUrls: urls.length, publishedWorksOnly: true, hiddenHeadingsWithoutJavaScript: hidden.length, canonicalRedirects: true });
  assert.deepEqual(report.errors, []);
  await nojs.close();
  await context.close();
  writeFileSync(`artifacts/seo-${label}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ base, pages: report.pages.length, checks: report.checks, errors: report.errors }, null, 2));
} finally { await browser.close(); }
