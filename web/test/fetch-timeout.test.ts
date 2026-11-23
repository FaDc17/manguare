import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchWithTimeout } from '../src/lib/fetch-timeout';

test('fetchWithTimeout respeta la cancelación externa', async () => {
  const originalFetch = globalThis.fetch;
  let receivedSignal: AbortSignal | undefined;
  globalThis.fetch = (_input, init) => {
    receivedSignal = init?.signal ?? undefined;
    return new Promise<Response>((_resolve, reject) => {
      receivedSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
  };
  try {
    const controller = new AbortController();
    const request = fetchWithTimeout('/api/test', { signal: controller.signal }, 10_000);
    controller.abort();
    await assert.rejects(request, { name: 'AbortError' });
    assert.equal(receivedSignal?.aborted, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
