#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { brainPacketPath, loadWorkspace, parseCliArgs, publicationStatus, sha256 } from './lib.mjs';

const args = parseCliArgs();
if (typeof args.key !== 'string') {
  console.error('Usage: npm run notes:context -- --key <translation-key> [--format json|md]');
  process.exit(1);
}
const format = typeof args.format === 'string' ? args.format : 'json';
if (!['json', 'md'].includes(format)) throw new Error('--format must be json or md');

const workspace = loadWorkspace();
const publication = workspace.publicationById.get(args.key);
if (!publication) throw new Error(`Unknown publication: ${args.key}`);
const notes = workspace.notes.filter((note) => note.data.translationKey === args.key);
const diagrams = (publication.data.visuals ?? []).map((id) => workspace.diagramById.get(id)).filter(Boolean);
const sources = (publication.data.sourceRoles ?? []).map(({ ref, role }) => ({
  role,
  entry: workspace.sourceById.get(typeof ref === 'string' ? ref : ref?.id),
}));
const packetPath = brainPacketPath(publication.data.researchPacket);
const packet = packetPath && existsSync(packetPath) ? readFileSync(packetPath, 'utf8') : null;
const parsedPacket = packet ? JSON.parse(packet) : null;
const context = {
  status: publicationStatus(undefined, args.key),
  publication: publication.data,
  editions: notes.map((note) => ({ lang: note.data.lang, file: relative(workspace.root, note.file), title: note.data.title, description: note.data.description })),
  sources: sources.map(({ role, entry }) => ({ id: entry?.id, role, ...(entry?.data ?? {}) })),
  diagrams: diagrams.map((diagram) => ({ id: diagram.id, kind: diagram.data.kind, claimRefs: diagram.data.claimRefs, question: diagram.data.copy.es.question })),
  research: {
    reference: publication.data.researchPacket ?? null,
    available: Boolean(packet),
    digestExpected: publication.data.researchDigest ?? null,
    digestCurrent: packet ? sha256(packet) : null,
    digestMatches: packet ? sha256(packet) === publication.data.researchDigest : null,
    packet: parsedPacket,
  },
};

if (format === 'json') {
  console.log(JSON.stringify(context, null, 2));
} else {
  console.log(`# ${args.key}\n`);
  console.log(`- Phase: **${context.status.phase}**`);
  console.log(`- Visibility: **${context.status.visibility}**`);
  console.log(`- Research packet: ${context.research.available ? 'available' : 'unavailable'}${context.research.digestMatches === false ? ' — DIGEST MISMATCH' : ''}`);
  console.log(`- Next action: \`${context.status.nextAction}\`\n`);
  console.log('## Editions\n');
  for (const edition of context.editions) console.log(`- ${edition.lang.toUpperCase()}: **${edition.title}** — \`${edition.file}\``);
  console.log('\n## Evidence surface\n');
  for (const source of context.sources) console.log(`- \`${source.id}\` (${source.role}) — ${source.title}`);
  if (parsedPacket?.evidence?.claims?.length) {
    console.log('\n## Claims\n');
    for (const claim of parsedPacket.evidence.claims) console.log(`- \`${claim.id}\` ${claim.statement} — ${claim.locator}`);
  }
  console.log('\n## Visuals\n');
  for (const diagram of context.diagrams) console.log(`- \`${diagram.id}\` (${diagram.kind}) — ${diagram.question}`);
  if (context.status.blockers.length) {
    console.log('\n## Blockers\n');
    for (const blocker of context.status.blockers) console.log(`- **${blocker.code}** ${blocker.message}`);
  }
}
