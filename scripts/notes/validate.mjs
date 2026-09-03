#!/usr/bin/env node
import { parseCliArgs, validateNotes, VALIDATION_TIERS } from './lib.mjs';

const args = parseCliArgs();
const tier = typeof args.tier === 'string' ? args.tier : 'editorial';
if (!VALIDATION_TIERS.includes(tier)) {
  console.error(`--tier must be one of: ${VALIDATION_TIERS.join(', ')}`);
  process.exit(1);
}

const result = validateNotes({
  tier,
  key: typeof args.key === 'string' ? args.key : undefined,
  publishedOnly: args['published-only'] === true,
});

if (args.json === true) {
  console.log(JSON.stringify({
    ok: result.diagnostics.length === 0,
    tier,
    diagnostics: result.diagnostics,
    counts: {
      works: result.publications.length,
      localizedEditions: result.notes.length,
      diagrams: result.diagrams.length,
      sources: result.sources.length,
    },
  }, null, 2));
} else if (result.errors.length > 0) {
  console.error(`Notes validation failed at “${tier}” tier with ${result.errors.length} issue(s):`);
  for (const error of result.errors) console.error(`- ${error}`);
} else {
  console.log(`Notes validation passed: ${result.publications.length} work(s), ${result.notes.length} localized editions, tier=${tier}.`);
}

if (result.errors.length > 0) process.exitCode = 1;
