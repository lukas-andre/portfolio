#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import matter from 'gray-matter';
import { loadNotes, parseCliArgs, projectRoot, validateNotes } from './lib.mjs';

const args = parseCliArgs();
if (!args.key || args.key === true || args['confirm-reviewed'] !== true) {
  console.error('Usage: npm run notes:publish -- --key <translation-key> --confirm-reviewed');
  console.error('This command only marks a reviewed pair as publishable; it does not commit, push, or deploy.');
  process.exit(1);
}

const before = validateNotes({ root: projectRoot });
if (before.errors.length) {
  console.error('Refusing to publish because notes validation fails.');
  for (const error of before.errors) console.error(`- ${error}`);
  process.exit(1);
}
const pair = loadNotes(projectRoot).filter((note) => note.data.translationKey === args.key);
if (pair.length !== 2) throw new Error(`Expected exactly two translations for ${args.key}`);
const today = new Date().toISOString().slice(0, 10);
const updates = pair.map((note) => {
  const parsed = matter(note.raw);
  parsed.data.draft = false;
  parsed.data.publishedAt ??= today;
  parsed.data.updatedAt = today;
  return { file: note.file, content: matter.stringify(parsed.content, parsed.data) };
});
for (const update of updates) writeFileSync(update.file, update.content);
console.log(`Marked ES/EN pair “${args.key}” as published. No commit, push, or deployment was performed.`);
