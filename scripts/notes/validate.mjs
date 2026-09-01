#!/usr/bin/env node
import { validateNotes } from './lib.mjs';

const { errors, notes } = validateNotes();
if (errors.length > 0) {
  console.error(`Notes validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Notes validation passed: ${notes.length} localized entries.`);
}
