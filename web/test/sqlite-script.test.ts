import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSqliteScript } from '../src/lib/sqlite-script.ts';

test('normaliza finales de línea para que el plugin SQLite Android separe sentencias', () => {
  assert.equal(normalizeSqliteScript('PRAGMA foreign_keys=ON;\r\nCREATE TABLE t(id);'), 'PRAGMA foreign_keys=ON;\nCREATE TABLE t(id);');
  assert.equal(normalizeSqliteScript('CREATE TABLE t(id);\n'), 'CREATE TABLE t(id);\n');
});
