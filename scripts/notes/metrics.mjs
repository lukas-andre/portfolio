#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadWorkspace, parseCliArgs } from './lib.mjs';

const args = parseCliArgs();
const period = String(args.period ?? '28d');
const workspace = loadWorkspace();
let input = { searchConsole: [], webAnalytics: [], machineRequests: [] };

if (typeof args.input === 'string') {
  const file = resolve(args.input);
  if (!existsSync(file)) throw new Error(`Metrics input does not exist: ${file}`);
  input = { ...input, ...JSON.parse(readFileSync(file, 'utf8')) };
}

const canonicalToKey = new Map();
for (const work of workspace.publications) {
  canonicalToKey.set(`/es/notas/${work.data.editions.es.slug}/`, work.id);
  canonicalToKey.set(`/en/notes/${work.data.editions.en.slug}/`, work.id);
}
function keyForUrl(value = '') {
  try { return canonicalToKey.get(new URL(value, 'https://lucashenry.dev').pathname.replace(/index\.md$/, '')) ?? null; }
  catch { return null; }
}

const rows = new Map(workspace.publications.map((work) => [work.id, {
  key: work.id,
  visibility: work.data.visibility,
  impressions: 0,
  clicks: 0,
  pageViews: 0,
  machineRequests: 0,
} ]));
for (const item of input.searchConsole ?? []) {
  const row = rows.get(keyForUrl(item.url ?? item.page));
  if (row) { row.impressions += Number(item.impressions ?? 0); row.clicks += Number(item.clicks ?? 0); }
}
for (const item of input.webAnalytics ?? []) {
  const row = rows.get(keyForUrl(item.url ?? item.path));
  if (row) row.pageViews += Number(item.pageViews ?? item.visits ?? 0);
}
for (const item of input.machineRequests ?? []) {
  const row = rows.get(item.key ?? keyForUrl(item.url ?? item.path));
  if (row) row.machineRequests += Number(item.requests ?? 0);
}
const snapshot = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  period,
  privacy: 'aggregate-only; no cookies, user identifiers, session replay, or raw IP addresses',
  configured: { input: typeof args.input === 'string', searchConsole: (input.searchConsole ?? []).length > 0, webAnalytics: (input.webAnalytics ?? []).length > 0 },
  works: [...rows.values()].map((row) => ({ ...row, ctr: row.impressions ? row.clicks / row.impressions : 0 })),
  next: typeof args.input === 'string'
    ? 'Compare by translationKey; propose internal links or topic follow-ups, never automatic content changes.'
    : 'Export aggregate Search Console and Cloudflare Web Analytics data into the documented input contract, then rerun with --input.',
};

if (args.save === true) {
  const brainRoot = process.env.LUCAS_BRAIN_ROOT ? resolve(process.env.LUCAS_BRAIN_ROOT) : resolve(workspace.root, '../../Lucas Brain');
  const file = resolve(brainRoot, 'library/paper-to-portfolio/metrics', `${new Date().toISOString().slice(0, 10)}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' });
  snapshot.savedTo = file;
}
console.log(JSON.stringify(snapshot, null, 2));
