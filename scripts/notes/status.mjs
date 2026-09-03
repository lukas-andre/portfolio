#!/usr/bin/env node
import { loadPublications, parseCliArgs, publicationStatus } from './lib.mjs';

const args = parseCliArgs();
const keys = typeof args.key === 'string' ? [args.key] : loadPublications().map((entry) => entry.id).sort();
const statuses = keys.map((key) => publicationStatus(undefined, key));

if (args.json === true || typeof args.key === 'string') {
  console.log(JSON.stringify(typeof args.key === 'string' ? statuses[0] : statuses, null, 2));
} else {
  for (const status of statuses) {
    console.log(`${status.key.padEnd(42)} ${status.phase.padEnd(15)} issue=${status.issue} blockers=${status.blockers.length}`);
    console.log(`  next: ${status.nextAction}`);
  }
}
