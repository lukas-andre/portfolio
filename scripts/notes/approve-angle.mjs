#!/usr/bin/env node
import { atomicWriteJson, loadWorkspace, parseCliArgs } from './lib.mjs';

const args = parseCliArgs();
const required = ['key', 'promise', 'thesis', 'counterpoint'];
const missing = required.filter((field) => typeof args[field] !== 'string' || args[field].trim().length < 20);
if (args['confirm-angle'] !== true || missing.length) {
  console.error('Usage: npm run notes:approve-angle -- --key <key> --confirm-angle --promise <text> --thesis <text> --counterpoint <text>');
  console.error('Promise, thesis, and counterpoint must each contain at least 20 characters.');
  process.exit(1);
}

const workspace = loadWorkspace();
const publication = workspace.publicationById.get(args.key);
if (!publication) throw new Error(`Unknown publication: ${args.key}`);
const next = structuredClone(publication.data);
const semantic = { readerPromise: args.promise.trim(), thesis: args.thesis.trim(), counterpoint: args.counterpoint.trim() };
const unchanged = next.angleApproval
  && next.angleApproval.readerPromise === semantic.readerPromise
  && next.angleApproval.thesis === semantic.thesis
  && next.angleApproval.counterpoint === semantic.counterpoint;
if (unchanged) {
  console.log(`Angle for ${args.key} is already approved with the same content.`);
  process.exit(0);
}
next.angleApproval = { approvedAt: new Date().toISOString().slice(0, 10), approvedBy: 'Lucas', ...semantic };
delete next.releaseApproval;
atomicWriteJson(publication.file, next);
console.log(`Recorded Lucas’s angle approval for ${args.key}. Any previous release approval was invalidated.`);
