#!/usr/bin/env node
import { atomicWriteJson, computeReleaseDigest, loadWorkspace, parseCliArgs, validateNotes } from './lib.mjs';

const args = parseCliArgs();
if (typeof args.key !== 'string' || args['confirm-reviewed'] !== true) {
  console.error('Usage: npm run notes:publish -- --key <translation-key> --confirm-reviewed');
  console.error('This changes one manifest only; it does not commit, push, or deploy.');
  process.exit(1);
}
const validation = validateNotes({ key: args.key, tier: 'render' });
if (validation.errors.length) {
  console.error('Refusing to publish because render validation fails:');
  for (const error of validation.errors) console.error(`- ${error}`);
  process.exit(1);
}
const workspace = loadWorkspace();
const publication = workspace.publicationById.get(args.key);
if (!publication) throw new Error(`Unknown publication: ${args.key}`);
const digest = computeReleaseDigest(undefined, args.key);
if (publication.data.releaseApproval?.digest !== digest) {
  console.error(`Refusing to publish ${args.key}: Lucas has not approved digest ${digest}.`);
  console.error(`Run: npm run notes:approve-release -- --key ${args.key} --confirm-reviewed`);
  process.exit(1);
}
if (publication.data.visibility === 'published') {
  console.log(`${args.key} is already published with the approved digest. No files changed.`);
  process.exit(0);
}
const next = structuredClone(publication.data);
next.visibility = 'published';
next.publishedAt ??= new Date().toISOString().slice(0, 10);
atomicWriteJson(publication.file, next);
console.log(`Marked ${args.key} as published in one atomic manifest update. No Git, push, or deployment action was performed.`);
