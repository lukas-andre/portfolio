#!/usr/bin/env node
import { loadWorkspace, parseCliArgs, publicationStatus } from './lib.mjs';

const args = parseCliArgs();
if (typeof args.key !== 'string') {
  console.error('Usage: npm run notes:preview -- --key <translation-key> [--origin http://127.0.0.1:4321]');
  process.exit(1);
}
const workspace = loadWorkspace();
const publication = workspace.publicationById.get(args.key);
if (!publication) throw new Error(`Unknown publication: ${args.key}`);
const status = publicationStatus(undefined, args.key);
const origin = String(args.origin ?? 'http://127.0.0.1:4321').replace(/\/$/, '');
console.log(JSON.stringify({
  key: args.key,
  phase: status.phase,
  blockers: status.blockers,
  start: 'npm run dev -- --host 127.0.0.1 --port 4321',
  urls: {
    es: `${origin}/es/notas/${publication.data.editions.es.slug}/`,
    en: `${origin}/en/notes/${publication.data.editions.en.slug}/`,
    esMarkdown: `${origin}/es/notas/${publication.data.editions.es.slug}/index.md`,
    enMarkdown: `${origin}/en/notes/${publication.data.editions.en.slug}/index.md`,
  },
}, null, 2));
