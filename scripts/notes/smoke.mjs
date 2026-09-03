#!/usr/bin/env node
import { loadWorkspace, parseCliArgs } from './lib.mjs';

const args = parseCliArgs();
const base = String(args['base-url'] ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const workspace = loadWorkspace();
const works = workspace.publications.filter((entry) => entry.data.visibility === 'published' && (!args.key || entry.id === args.key));
if (args.key && works.length === 0) throw new Error(`No published work found for ${args.key}`);

const checks = [
  ['/robots.txt', 'text/plain'],
  ['/sitemap-index.xml', 'application/xml'],
  ['/llms.txt', 'text/plain'],
  ['/notes/manifest.json', 'application/json'],
  ['/es/notas/feed.xml', 'application/rss+xml'],
  ['/en/notes/feed.xml', 'application/rss+xml'],
];
for (const work of works) {
  checks.push(
    [`/es/notas/${work.data.editions.es.slug}/`, 'text/html'],
    [`/en/notes/${work.data.editions.en.slug}/`, 'text/html'],
    [`/es/notas/${work.data.editions.es.slug}/index.md`, 'text/markdown'],
    [`/en/notes/${work.data.editions.en.slug}/index.md`, 'text/markdown'],
  );
}

const results = [];
for (const [path, expectedType] of checks) {
  try {
    const response = await fetch(`${base}${path}`, { redirect: 'follow' });
    const contentType = response.headers.get('content-type') ?? '';
    const ok = response.ok && contentType.includes(expectedType);
    results.push({ path, status: response.status, contentType, ok });
  } catch (error) {
    results.push({ path, status: 0, contentType: '', ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}
console.log(JSON.stringify({ base, ok: results.every((result) => result.ok), results }, null, 2));
if (results.some((result) => !result.ok)) process.exitCode = 1;
