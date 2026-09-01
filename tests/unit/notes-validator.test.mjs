import assert from 'node:assert/strict';
import test from 'node:test';
import { validateNotes } from '../../scripts/notes/lib.mjs';

test('the bilingual notes corpus satisfies the editorial contract', () => {
  const { errors, notes } = validateNotes();
  assert.deepEqual(errors, []);
  assert.equal(notes.length, 2);
});
