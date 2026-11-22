import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createLocalBiodiversityReport, syncBiodiversityReports } from '../src/lib/biodiversity';
import { clearBiodiversityReports, getBiodiversityReport } from '../src/lib/db';
import { fetchWithTimeout } from '../src/lib/fetch-timeout';

const realFetch = globalThis.fetch;
beforeEach(async () => { await clearBiodiversityReports(); });
afterEach(() => { globalThis.fetch = realFetch; });

test('un reporte eliminado mientras se envía no reaparece en el dispositivo', async () => {
  const report = await createLocalBiodiversityReport({
    category: 'Contaminación de ríos', title: 'Agua turbia', description: 'Observación',
    community: 'Prueba', reportedBy: 'Ana',
  });
  let started!: () => void;
  let finish!: (response: Response) => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  const pendingResponse = new Promise<Response>((resolve) => { finish = resolve; });
  globalThis.fetch = (async () => { started(); return pendingResponse; }) as typeof fetch;
  const sync = syncBiodiversityReports();
  await entered;
  await clearBiodiversityReports();
  finish(new Response(JSON.stringify({ report: {
    ...report, state: 'sent', serverReceivedAt: new Date().toISOString(),
  } }), { status: 201 }));
  await sync;
  assert.equal(await getBiodiversityReport(report.id), undefined);
});

test('una solicitud que nunca responde se cancela al vencer el plazo', async () => {
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  })) as typeof fetch;
  await assert.rejects(fetchWithTimeout('/api/prueba', {}, 5), { name: 'AbortError' });
});
