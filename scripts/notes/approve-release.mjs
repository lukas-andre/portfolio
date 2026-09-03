#!/usr/bin/env node
import { atomicWriteJson, computeReleaseDigest, loadWorkspace, parseCliArgs, validateNotes } from './lib.mjs';

const args = parseCliArgs();
if (typeof args.key !== 'string' || args['confirm-reviewed'] !== true) {
  console.error('Usage: npm run notes:approve-release -- --key <translation-key> --confirm-reviewed [--migrate-existing]');
  process.exit(1);
}
const validation = validateNotes({ key: args.key, tier: 'render' });
if (validation.errors.length) {
  console.error('Refusing approval because render validation fails:');
  for (const error of validation.errors) console.error(`- ${error}`);
  process.exit(1);
}
const workspace = loadWorkspace();
const publication = workspace.publicationById.get(args.key);
if (!publication) throw new Error(`Unknown publication: ${args.key}`);
const digest = computeReleaseDigest(undefined, args.key);
if (publication.data.releaseApproval?.digest === digest) {
  console.log(`Release ${args.key} is already approved for digest ${digest}.`);
  process.exit(0);
}
const next = structuredClone(publication.data);
next.releaseApproval = {
  digest,
  approvedAt: new Date().toISOString().slice(0, 10),
  approvedBy: 'Lucas',
  ...(args['migrate-existing'] === true ? { migratedFromPublishedState: true } : {}),
};
atomicWriteJson(publication.file, next);
console.log(`Approved exact release bytes for ${args.key}: ${digest}. No publish, Git, or deployment action was performed.`);
