#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import matter from 'gray-matter';
import { atomicWriteJson, brainPacketPath, loadWorkspace, parseCliArgs, projectRoot, sha256 } from './lib.mjs';

const args = parseCliArgs();
const required = ['key', 'es-slug', 'en-slug', 'source'];
const missing = required.filter((field) => typeof args[field] !== 'string');
if (missing.length) {
  console.error('Usage: npm run notes:new -- --key <translation-key> --es-slug <slug> --en-slug <slug> --source <source-id[,source-id...]> [--kind single|synthesis|essay]');
  process.exit(1);
}
for (const field of ['key', 'es-slug', 'en-slug']) if (!/^[a-z0-9][a-z0-9.-]*$/.test(args[field])) throw new Error(`Invalid --${field}: use lowercase letters, numbers, dots, and hyphens.`);
const kind = args.kind ?? 'single';
if (!['single', 'synthesis', 'essay'].includes(kind)) throw new Error('--kind must be single, synthesis, or essay');

const workspace = loadWorkspace();
const sourceIds = args.source.split(',').map((value) => value.trim()).filter(Boolean);
if (sourceIds.length === 0) throw new Error('At least one source ID is required.');
for (const sourceId of sourceIds) if (!workspace.sourceById.has(sourceId)) throw new Error(`Unknown source: ${sourceId}`);
const existing = workspace.publicationById.get(args.key);
const highestIssue = Math.max(0, ...workspace.publications.map((entry) => Number(entry.data.issue) || 0));
const manifestFile = join(projectRoot, 'src/content/publications', `${args.key}.json`);
if (!existing) {
  const researchPacket = typeof args['research-packet'] === 'string'
    ? args['research-packet']
    : `brain://library/paper-to-portfolio/works/${args.key}.json`;
  const packetPath = brainPacketPath(researchPacket);
  const researchDigest = packetPath && existsSync(packetPath) ? sha256(readFileSync(packetPath)) : undefined;
  atomicWriteJson(manifestFile, {
    schemaVersion: 1,
    kind,
    issue: String(highestIssue + 1).padStart(3, '0'),
    topics: ['research'],
    related: [],
    sourceRoles: sourceIds.map((ref, index) => ({ ref, role: index === 0 ? 'primary' : 'supporting' })),
    editions: { es: { slug: args['es-slug'] }, en: { slug: args['en-slug'] } },
    visuals: [],
    researchPacket,
    ...(researchDigest ? { researchDigest } : {}),
    visibility: 'draft',
  });
  console.log(`Created ${manifestFile}`);
} else {
  const expected = existing.data.editions;
  if (expected.es.slug !== args['es-slug'] || expected.en.slug !== args['en-slug']) throw new Error(`Existing manifest ${args.key} uses different slugs.`);
  console.log(`Reused existing manifest ${manifestFile}`);
}

function atomicWrite(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  writeFileSync(temporary, content, { flag: 'wx' });
  renameSync(temporary, file);
}

const today = new Date().toISOString().slice(0, 10);
for (const edition of [
  { lang: 'es', slug: args['es-slug'], title: 'Nueva nota de investigación', description: 'Scaffold editorial pendiente de aprobación de ángulo.' },
  { lang: 'en', slug: args['en-slug'], title: 'New research note', description: 'Editorial scaffold awaiting angle approval.' },
]) {
  const file = join(projectRoot, 'src/content/notes', edition.lang, `${edition.slug}.mdx`);
  if (existsSync(file)) {
    const parsed = matter(readFileSync(file, 'utf8'));
    if (parsed.data.translationKey !== args.key || parsed.data.lang !== edition.lang) throw new Error(`Existing file belongs to another work: ${file}`);
    console.log(`Reused ${file}`);
    continue;
  }
  const content = `---\ntranslationKey: ${args.key}\nlang: ${edition.lang}\ntitle: "${edition.title}"\ndescription: "${edition.description}"\nupdatedAt: ${today}\ntags: [research]\naiAssisted: true\n---\n\nimport Cite from '../../../components/notes/Cite.astro';\nimport Callout from '../../../components/notes/Callout.astro';\nimport MyTake from '../../../components/notes/MyTake.astro';\nimport NoteFigure from '../../../components/notes/NoteFigure.astro';\n\nThis scaffold intentionally remains outside rendered routes until its angle, evidence, prose, and visuals are complete.\n`;
  atomicWrite(file, content);
  console.log(`Created ${file}`);
}

console.log(`Work ${args.key} is awaiting angle approval. It does not block other drafts or production.`);
