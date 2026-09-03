import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import {
  brainPacketPath,
  computeReleaseDigest,
  loadWorkspace,
  publicationStatus,
  sha256,
  validateNotes,
} from '../../scripts/notes/lib.mjs';

test('every PublicationWork has a valid bilingual, evidence-linked render surface', () => {
  const result = validateNotes({ tier: 'render' });
  assert.deepEqual(result.errors, []);

  const workspace = loadWorkspace();
  assert.ok(workspace.publications.length > 0);
  assert.equal(new Set(workspace.publications.map((entry) => entry.data.issue)).size, workspace.publications.length);

  for (const publication of workspace.publications) {
    const editions = workspace.notes
      .filter((note) => note.data.translationKey === publication.id)
      .map((note) => note.data.lang)
      .sort();
    assert.deepEqual(editions, ['en', 'es'], publication.id);
    assert.ok(publication.data.visuals.length >= 2 && publication.data.visuals.length <= 4, publication.id);

    const packetPath = brainPacketPath(publication.data.researchPacket);
    if (packetPath && existsSync(packetPath)) {
      assert.equal(sha256(readFileSync(packetPath)), publication.data.researchDigest, publication.id);
    }
  }
});

test('release digests and lifecycle status are deterministic and actionable', () => {
  const workspace = loadWorkspace();
  for (const publication of workspace.publications) {
    const first = computeReleaseDigest(undefined, publication.id);
    const second = computeReleaseDigest(undefined, publication.id);
    assert.match(first, /^[a-f0-9]{64}$/);
    assert.equal(first, second, publication.id);

    const status = publicationStatus(undefined, publication.id);
    assert.equal(status.digest, first);
    assert.ok(['awaiting-angle', 'drafting', 'review-ready', 'approved', 'published'].includes(status.phase));
    assert.match(status.nextAction, /^npm run notes:/);
  }
});
