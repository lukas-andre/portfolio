#!/usr/bin/env node
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCliArgs, projectRoot } from './lib.mjs';

const args = parseCliArgs();
const required = ['key', 'es-slug', 'en-slug', 'source'];
const missing = required.filter((key) => !args[key] || args[key] === true);
if (missing.length) {
  console.error(`Usage: npm run notes:new -- --key <translation-key> --es-slug <slug> --en-slug <slug> --source <source-id> [--kind single|synthesis]`);
  process.exit(1);
}

for (const key of ['key', 'es-slug', 'en-slug', 'source']) {
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(args[key])) throw new Error(`Invalid --${key}: use lowercase letters, numbers, dots, and hyphens.`);
}
const kind = args.kind ?? 'single';
if (!['single', 'synthesis'].includes(kind)) throw new Error('--kind must be single or synthesis');
const sourceFile = join(projectRoot, 'src/content/sources', `${args.source}.json`);
if (!existsSync(sourceFile)) throw new Error(`Source does not exist: ${args.source}`);

const today = new Date().toISOString().slice(0, 10);
const files = [
  { lang: 'es', slug: args['es-slug'], title: 'Título por definir', description: 'Descripción editorial por definir en español.' },
  { lang: 'en', slug: args['en-slug'], title: 'Title to define', description: 'Editorial description to define in English.' },
].map((entry) => ({ ...entry, file: join(projectRoot, 'src/content/notes', entry.lang, `${entry.slug}.mdx`) }));

for (const entry of files) if (existsSync(entry.file)) throw new Error(`Refusing to overwrite ${entry.file}`);
for (const entry of files) {
  const body = `---\ntranslationKey: ${args.key}\nlang: ${entry.lang}\nkind: ${kind}\ntitle: "${entry.title}"\ndescription: "${entry.description}"\ndraft: true\nupdatedAt: ${today}\ntags: [research]\nsources:\n  - ref: ${args.source}\n    role: primary\naiAssisted: true\ndiagrams: []\n---\n\nimport Cite from '../../../components/notes/Cite.astro';\nimport Callout from '../../../components/notes/Callout.astro';\nimport MyTake from '../../../components/notes/MyTake.astro';\nimport NoteFigure from '../../../components/notes/NoteFigure.astro';\n\nComplete the editorial checkpoint, article, citations, and 2–4 diagrams before previewing.\n`;
  writeFileSync(entry.file, body, { flag: 'wx' });
  console.log(`Created ${entry.file}`);
}
console.log('The pair is intentionally incomplete and remains a draft. Finish it before running validate:notes.');
