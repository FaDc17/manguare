import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createHandler } from '../src/app.js';
import { createAuth } from '../src/auth.js';
import { AlertStore } from '../src/store.js';
import { readPeriod, buildStatistics } from '../src/statistics.js';
import { statisticsXlsx } from '../src/statistics-xlsx.js';

process.env.MANGUARE_LOG = '0';
const previousDemo = process.env.MANGUARE_STATS_DEMO;
process.env.MANGUARE_STATS_DEMO = '1';
let directory;
let server;
let base;
let cookie;

function storedZipEntries(buffer) {
  const entries = new Map();
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLength);
    const start = offset + 30 + nameLength + extraLength;
    entries.set(name, buffer.toString('utf8', start, start + size));
    offset = start + size;
  }
  assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
  return entries;
}

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'manguare-stats-'));
  const staticDir = path.join(directory, 'static');
  await fs.mkdir(staticDir);
  const store = new AlertStore(path.join(directory, 'alerts.json'));
  const baseAlert = {
    type: 'enfermedad', note: '=PRIVATE_NOTE', community: 'Secreto', deviceName: 'Teléfono',
    reporterPhone: '999888777', consentLocation: true,
    location: { lat: -5, lng: -76, accuracy: 1, capturedAt: '2026-11-22T04:00:00Z' },
    clientCreatedAt: '2026-11-22T04:00:00Z',
  };
  await store.add({ ...baseAlert, id: 'stats-0001', serverReceivedAt: '2026-11-22T04:30:00Z', acknowledgedAt: '2026-11-22T05:00:00Z' });
  await store.add({ ...baseAlert, id: 'stats-0002', type: 'parto', serverReceivedAt: '2026-11-01T05:30:00Z' });
  await store.add({ ...baseAlert, id: 'stats-0003', serverReceivedAt: '2026-10-31T04:30:00Z' });
  const auth = createAuth({ enabled: true, password: 'test-secret' });
  server = http.createServer(createHandler({ store, staticDir, auth, now: () => '2026-11-22T16:00:00Z' }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${base}/api/panel/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'salud', password: 'test-secret' }),
  });
  cookie = login.headers.get('set-cookie').split(';')[0];
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(directory, { recursive: true, force: true });
  if (previousDemo === undefined) delete process.env.MANGUARE_STATS_DEMO;
  else process.env.MANGUARE_STATS_DEMO = previousDemo;
});

test('solo una sesión protegida accede a estadísticas y Excel', async () => {
  for (const endpoint of ['/api/panel/statistics', '/api/panel/statistics/export']) {
    assert.equal((await fetch(base + endpoint)).status, 401);
  }
  assert.equal((await fetch(`${base}/api/panel/statistics?period=custom&from=2026-13-01&to=2026-11-22`, {
    headers: { Cookie: cookie },
  })).status, 400);
});

test('filtra por llegada al servidor en hora de Lima, sin duplicar ni contar pendientes locales', async () => {
  const response = await fetch(`${base}/api/panel/statistics?period=month`, { headers: { Cookie: cookie } });
  const report = await response.json();
  assert.equal(report.total, 2);
  assert.deepEqual(report.byStatus, { sent: 1, received: 1 });
  assert.deepEqual(report.byType, { enfermedad: 1, parto: 1 });
  assert.equal(report.averageConfirmationMinutes, 30);
  assert.equal(report.monthly[0].month, '2026-11');
  assert.equal(report.detail, undefined);
  const last7 = await (await fetch(`${base}/api/panel/statistics?period=last7`, { headers: { Cookie: cookie } })).json();
  assert.equal(last7.total, 1);
  const empty = await (await fetch(`${base}/api/panel/statistics?period=custom&from=2026-09-01&to=2026-09-30`, { headers: { Cookie: cookie } })).json();
  assert.equal(empty.total, 0);
  assert.equal(empty.averageConfirmationMinutes, null);
});

test('genera un XLSX con tres hojas y sin datos personales', async () => {
  const response = await fetch(`${base}/api/panel/statistics/export?period=last7`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /spreadsheetml\.sheet/);
  const workbook = Buffer.from(await response.arrayBuffer());
  const files = storedZipEntries(workbook);
  assert.equal(files.size, 8);
  assert.match(files.get('xl/workbook.xml'), /Resumen general/);
  assert.match(files.get('xl/workbook.xml'), /Detalle de emergencias/);
  assert.match(files.get('xl/workbook.xml'), /Estadísticas mensuales/);
  const details = files.get('xl/worksheets/sheet2.xml');
  assert.match(details, /stats-0001/);
  assert.doesNotMatch(details, /stats-0002|PRIVATE_NOTE|999888777|Secreto|-76/);
  assert.match(files.get('xl/worksheets/sheet1.xml'), /<v>1<\/v>/);
});

test('modo DEMO aislado de alertas reales y etiquetado en Excel', async () => {
  const demo = await (await fetch(`${base}/api/panel/statistics?period=last30&demo=1`, { headers: { Cookie: cookie } })).json();
  assert.equal(demo.demo, true);
  assert.equal(demo.demoAvailable, true);
  assert.equal(demo.total, 4);
  const response = await fetch(`${base}/api/panel/statistics/export?period=last30&demo=1`, { headers: { Cookie: cookie } });
  assert.match(response.headers.get('content-disposition'), /DEMO/);
  const files = storedZipEntries(Buffer.from(await response.arrayBuffer()));
  assert.match(files.get('xl/worksheets/sheet1.xml'), /información ficticia/);
  assert.doesNotMatch(files.get('xl/worksheets/sheet2.xml'), /stats-0001/);
  const real = await (await fetch(`${base}/api/panel/statistics?period=month`, { headers: { Cookie: cookie } })).json();
  assert.equal(real.total, 2);
});

test('modo DEMO se rechaza en producción', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const response = await fetch(`${base}/api/panel/statistics?demo=1`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 403);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('rechaza rangos imposibles y mantiene días inclusivos', () => {
  assert.equal(readPeriod(new URLSearchParams('period=custom&from=2026-02-30&to=2026-03-01')), null);
  const period = readPeriod(new URLSearchParams('period=custom&from=2026-11-21&to=2026-11-21'));
  assert.equal(buildStatistics([{ id: 'x', type: 'otro', serverReceivedAt: '2026-11-22T04:59:59Z' }], period).total, 1);
});

test('el Excel conserva texto peligroso como texto, nunca como fórmula', () => {
  const period = readPeriod(new URLSearchParams('period=custom&from=2026-11-22&to=2026-11-22'));
  const report = buildStatistics([{
    id: '=HYPERLINK("https://ejemplo.test")', type: 'enfermedad',
    serverReceivedAt: '2026-11-22T16:00:00Z', clientCreatedAt: '2026-11-22T15:00:00Z',
  }], period);
  const detail = storedZipEntries(statisticsXlsx(report)).get('xl/worksheets/sheet2.xml');
  assert.match(detail, /&apos;=HYPERLINK/);
  assert.doesNotMatch(detail, /<f[ >]/);
});
