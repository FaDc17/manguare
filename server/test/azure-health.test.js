import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { createHandler } from '../src/app.js';

test('el endpoint de salud falla si Azure SQL no responde', async () => {
  const server = http.createServer(createHandler({
    store: { list: async () => [] },
    staticDir: '.',
    healthCheck: async () => { throw new Error('SQL no disponible'); },
  }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'internal_error' });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
