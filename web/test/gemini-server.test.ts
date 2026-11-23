import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeNativeApiBase } from '../src/lib/api-url.ts';
import { checkGeminiServer } from '../src/lib/gemini-server.ts';

describe('servidor Gemini del APK', () => {
  it('admite HTTP de la red privada solo en el APK local y mantiene HTTPS', () => {
    assert.equal(normalizeNativeApiBase(' https://manguare.example.org/ '), 'https://manguare.example.org');
    assert.throws(() => normalizeNativeApiBase('http://manguare.example.org'));
    assert.equal(normalizeNativeApiBase(' http://192.168.1.10:8787/ ', true), 'http://192.168.1.10:8787');
    assert.equal(normalizeNativeApiBase('http://10.0.2.2:8787', true), 'http://10.0.2.2:8787');
    assert.equal(normalizeNativeApiBase('http://172.31.0.4:8787', true), 'http://172.31.0.4:8787');
    assert.throws(() => normalizeNativeApiBase('http://192.168.1.10:8787'));
    assert.throws(() => normalizeNativeApiBase('http://manguare.example.org', true));
    assert.throws(() => normalizeNativeApiBase('http://127.0.0.1:8787', true));
    assert.throws(() => normalizeNativeApiBase('http://192.168.1.10:8787/api', true));
    assert.throws(() => normalizeNativeApiBase('https://localhost:8787'));
    assert.throws(() => normalizeNativeApiBase('https://manguare.example.org/api'));
  });

  it('comprueba que el servidor responde y emite un token temporal', async () => {
    const original = globalThis.fetch;
    const requested: string[] = [];
    globalThis.fetch = async (input) => {
      requested.push(String(input));
      return new Response(JSON.stringify(requested.length === 1
        ? { ok: true } : { token: 'auth_tokens/test', model: 'gemini-3.8-live' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    };
    try {
      assert.deepEqual(await checkGeminiServer('https://manguare.example.org'),
        { ok: true, model: 'gemini-3.8-live' });
      assert.deepEqual(requested, [
        'https://manguare.example.org/api/health',
        'https://manguare.example.org/api/gemini/token',
      ]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('separa falta de clave, servidor equivocado y red caída', async () => {
    const original = globalThis.fetch;
    try {
      globalThis.fetch = async (input) => new Response(JSON.stringify(
        String(input).endsWith('/api/health') ? { ok: true } : { error: 'gemini_not_configured' },
      ), { status: String(input).endsWith('/api/health') ? 200 : 503 });
      assert.deepEqual(await checkGeminiServer('https://manguare.example.org'),
        { ok: false, code: 'gemini_not_configured' });
      globalThis.fetch = async () => new Response('<html>otra web</html>', { status: 200 });
      assert.deepEqual(await checkGeminiServer('https://manguare.example.org'),
        { ok: false, code: 'not_manguare' });
      globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
      assert.deepEqual(await checkGeminiServer('https://manguare.example.org'),
        { ok: false, code: 'unreachable' });
    } finally {
      globalThis.fetch = original;
    }
  });
});
