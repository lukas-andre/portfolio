#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { atomicWriteJson, brainPacketPath, loadWorkspace, parseCliArgs, sha256 } from './lib.mjs';

const args = parseCliArgs();
const workspace = loadWorkspace();
const selected = workspace.publications.filter((publication) => !args.key || publication.id === args.key);

if (args.key && selected.length === 0) throw new Error(`Unknown publication: ${args.key}`);
if (selected.length === 0) throw new Error('No publication manifests found.');

for (const publication of selected) {
  const packetPath = brainPacketPath(publication.data.researchPacket);
  if (!packetPath || !existsSync(packetPath)) {
    throw new Error(`ResearchPacket unavailable for ${publication.id}. Set LUCAS_BRAIN_ROOT if the Brain is elsewhere.`);
  }
  const bytes = readFileSync(packetPath);
  const packet = JSON.parse(bytes);
  if (packet.schemaVersion !== 1 || packet.id !== publication.id) {
    throw new Error(`ResearchPacket identity mismatch for ${publication.id}.`);
  }
  const digest = sha256(bytes);
  if (publication.data.researchDigest === digest) {
    console.log(`${publication.id}: already current (${digest})`);
    continue;
  }
  publication.data.researchDigest = digest;
  delete publication.data.releaseApproval;
  atomicWriteJson(publication.file, publication.data);
  console.log(`${publication.id}: research digest synced; release approval invalidated (${digest})`);
}
