#!/usr/bin/env node
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { loadWorkspace, projectRoot } from './lib.mjs';

const notesRoot = resolve(projectRoot, 'dist/images/notes');
if (!existsSync(notesRoot)) process.exit(0);

const workspace = loadWorkspace();
const keepArtworkRoots = new Set();
const includeDrafts = process.env.INCLUDE_DRAFTS === 'true';
for (const publication of workspace.publications.filter((entry) => includeDrafts || entry.data.visibility === 'published')) {
  for (const visualId of publication.data.visuals ?? []) {
    const diagram = workspace.diagramById.get(visualId);
    for (const artwork of Object.values(diagram?.data.artwork ?? {})) {
      const match = artwork.match(/^\/images\/notes\/([^/]+)\//);
      if (match) keepArtworkRoots.add(match[1]);
    }
  }
}

const removed = [];
for (const entry of readdirSync(notesRoot, { withFileTypes: true })) {
  if (entry.name === 'diagrams' || keepArtworkRoots.has(entry.name)) continue;
  const target = resolve(notesRoot, entry.name);
  if (!target.startsWith(`${notesRoot}${sep}`)) throw new Error(`Refusing unsafe dist cleanup target: ${target}`);
  rmSync(target, { recursive: entry.isDirectory(), force: true });
  removed.push(join('dist/images/notes', entry.name));
}

if (removed.length) console.log(`Removed ${removed.length} unpublished diagram artwork path(s) from generated dist.`);
