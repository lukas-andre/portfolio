import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCliArgs } from '../../scripts/notes/lib.mjs';

test('parseCliArgs handles values and a trailing boolean flag', () => {
  assert.deepEqual(
    parseCliArgs(['--key', 'end-of-software-engineering', '--confirm-reviewed']),
    { key: 'end-of-software-engineering', 'confirm-reviewed': true },
  );
});

test('parseCliArgs supports equals syntax', () => {
  assert.deepEqual(parseCliArgs(['--kind=synthesis']), { kind: 'synthesis' });
});
