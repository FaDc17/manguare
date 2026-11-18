import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createHandler } from '../src/app.js';
import { BiodiversityStore } from '../src/biodiversity-store.js';
import { AlertStore } from '../src/store.js';

process.env.MANGUARE_LOG = '0';

let server;
let base;
let directory;

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'manguare-test-'));
  const staticDir = path.join(directory, 'static');
  await fs.mkdir(staticDir, { recursive: true });
  await fs.writeFile(path.join(staticDir, 'index.html'), '<html>INDEX</html>');
  await fs.writeFile(path.join(staticDir, 'panel.html'), '<html>PANEL</html>');
  await fs.writeFile(path.join(staticDir, 'sw.js'), 'self.addEventListener("install", () => {});');
  await fs.writeFile(path.join(staticDir, 'manifest.webmanifest'), '{}');

  const store = new AlertStore(path.join(directory, 'alerts.json'));
  const biodiversityStore = new BiodiversityStore(path.join(directory, 'biodiversity.json'));
  server = http.createServer(createHandler({ store, biodiversityStore, staticDir }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(directory, { recursive: true, force: true });
});

function payload(overrides = {}) {
  return {
    id: 'test-alert-0001',
    type: 'enfermedad',
    note: 'Fiebre alta desde ayer',
    community: 'Nueva Esperanza',
    deviceName: 'Celular de prueba',
    reportedBy: 'Juan',
    reporterPhone: '992066275',
    consentLocation: true,
    location: {
      lat: -5.9012,
      lng: -76.1043,
      accuracy: 18,
      capturedAt: new Date().toISOString(),
    },
    clientCreatedAt: new Date().toISOString(),
    ...overrides,
  };
}

async function postAlert(body) {
  const response = await fetch(`${base}/api/alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { response, data: await response.json().catch(() => ({})) };
}

async function postBiodiversityReport(body) {
  const response = await fetch(`${base}/api/biodiversity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { response, data: await response.json().catch(() => ({})) };
}

function biodiversityPayload(overrides = {}) {
  return {
    id: 'test-bio-report-01',
    category: 'Tala ilegal',
    title: 'Tala junto a la quebrada',
    description: 'Se observan árboles cortados cerca del camino comunal.',
    community: 'Awajún',
    reportedBy: 'Juan',
    clientCreatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test('crea una alerta y es idempotente por id', async () => {
  const first = await postAlert(payload());
  assert.equal(first.response.status, 201);
  assert.equal(first.data.alert.id, 'test-alert-0001');
  assert.ok(first.data.alert.serverReceivedAt);
  assert.equal(first.data.alert.reportedBy, 'Juan');
  assert.equal(first.data.alert.reporterPhone, '992066275');
  assert.equal(first.data.alert.acknowledgedAt, undefined);

  const second = await postAlert(payload({ note: 'Otro texto' }));
  assert.equal(second.response.status, 200);
  assert.equal(second.data.alert.note, 'Fiebre alta desde ayer');

  const list = await (await fetch(`${base}/api/alerts`)).json();
  assert.equal(list.alerts.length, 1);
});

test('marca como recibida de forma idempotente', async () => {
  const first = await fetch(`${base}/api/alerts/test-alert-0001/received`, { method: 'POST' });
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.ok(firstBody.alert.acknowledgedAt);

  const second = await fetch(`${base}/api/alerts/test-alert-0001/received`, { method: 'POST' });
  const secondBody = await second.json();
  assert.equal(secondBody.alert.acknowledgedAt, firstBody.alert.acknowledgedAt);

  const missing = await fetch(`${base}/api/alerts/no-existe-999/received`, { method: 'POST' });
  assert.equal(missing.status, 404);
});

test('sincroniza el estado de la alerta al consultarla', async () => {
  const response = await fetch(`${base}/api/alerts/test-alert-0001`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.alert.acknowledgedAt);
});

test('completa una alerta SOS ya creada sin generar otra', async () => {
  const created = await postAlert(
    payload({ id: 'sos-alert-0001', isSos: true, note: 'Alerta SOS' }),
  );
  assert.equal(created.response.status, 201);
  assert.equal(created.data.alert.isSos, true);

  const updated = await fetch(`${base}/api/alerts/sos-alert-0001`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      note: 'Necesito ayuda cerca del río.',
      community: 'Chiriaco',
      consentLocation: false,
      photo: null,
    }),
  });
  assert.equal(updated.status, 200);
  const updatedBody = await updated.json();
  assert.equal(updatedBody.alert.id, created.data.alert.id);
  assert.equal(updatedBody.alert.isSos, true);
  assert.equal(updatedBody.alert.note, 'Necesito ayuda cerca del río.');

  const list = await (await fetch(`${base}/api/alerts`)).json();
  assert.equal(list.alerts.filter((alert) => alert.id === 'sos-alert-0001').length, 1);
});

test('rechaza datos inválidos sin guardar', async () => {
  const before = (await (await fetch(`${base}/api/alerts`)).json()).alerts.length;
  const badType = await postAlert(payload({ id: 'test-alert-bad1', type: 'inventado' }));
  assert.equal(badType.response.status, 400);
  assert.equal(badType.data.error, 'invalid_type');

  const badLocation = await postAlert(
    payload({ id: 'test-alert-bad2', location: { lat: 200, lng: 0 } }),
  );
  assert.equal(badLocation.response.status, 400);

  const badPhoto = await postAlert(payload({ id: 'test-alert-bad3', photo: 'no-es-foto' }));
  assert.equal(badPhoto.response.status, 400);

  const badId = await postAlert(payload({ id: 'corto' }));
  assert.equal(badId.response.status, 400);

  const list = await (await fetch(`${base}/api/alerts`)).json();
  assert.equal(list.alerts.length, before);
});

test('no guarda ubicación si no hay consentimiento', async () => {
  const result = await postAlert(
    payload({
      id: 'test-alert-noconsent',
      consentLocation: false,
      location: { lat: -5.9, lng: -76.1, accuracy: 10, capturedAt: new Date().toISOString() },
    }),
  );
  assert.equal(result.response.status, 201);
  assert.equal(result.data.alert.location, undefined);
  assert.equal(result.data.alert.consentLocation, false);
});

test('sirve la app, el panel y el service worker', async () => {
  const index = await fetch(`${base}/`);
  assert.equal(index.status, 200);
  assert.match(await index.text(), /INDEX/);
  assert.ok(index.headers.get('content-security-policy')?.includes("default-src 'self'"));

  const panel = await fetch(`${base}/panel`);
  assert.equal(panel.status, 200);
  assert.match(await panel.text(), /PANEL/);

  const sw = await fetch(`${base}/sw.js`);
  assert.equal(sw.status, 200);
  assert.equal(sw.headers.get('cache-control'), 'no-cache');

  const missing = await fetch(`${base}/ruta-inexistente`);
  assert.equal(missing.status, 404);
});

test('expone salud y no permite leer el archivo de datos', async () => {
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  const data = await health.json();
  assert.equal(data.ok, true);
  assert.equal(data.alerts, 3);

  const traversal = await fetch(`${base}/../package.json`);
  assert.ok([403, 404].includes(traversal.status));
});

test('persiste las alertas en disco', async () => {
  const file = path.join(directory, 'alerts.json');
  const raw = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(raw.alerts.length, 3);
  assert.ok(raw.alerts.some((alert) => alert.id === 'test-alert-0001'));
});

test('guarda y lista reportes de biodiversidad en su API separada', async () => {
  const created = await postBiodiversityReport(biodiversityPayload());
  assert.equal(created.response.status, 201);
  assert.equal(created.data.report.category, 'Tala ilegal');
  assert.equal(created.data.report.state, 'sent');
  assert.ok(created.data.report.serverReceivedAt);

  const repeated = await postBiodiversityReport(
    biodiversityPayload({ description: 'No debe duplicarse.' }),
  );
  assert.equal(repeated.response.status, 200);
  assert.equal(repeated.data.report.description, 'Se observan árboles cortados cerca del camino comunal.');

  const listed = await fetch(`${base}/api/biodiversity`);
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).reports.length, 1);

  const status = await fetch(`${base}/api/biodiversity/test-bio-report-01/status`);
  assert.equal(status.status, 200);
  const statusReport = (await status.json()).report;
  assert.equal(statusReport.id, 'test-bio-report-01');
  assert.equal(statusReport.state, 'sent');
  assert.equal(statusReport.serverReceivedAt, created.data.report.serverReceivedAt);
  assert.deepEqual(Object.keys(statusReport).sort(), ['id', 'serverReceivedAt', 'state']);
});

test('la red puede marcar un reporte de biodiversidad como leído', async () => {
  const created = await postBiodiversityReport(
    biodiversityPayload({ id: 'test-bio-report-02' }),
  );
  assert.equal(created.response.status, 201);

  const marked = await fetch(`${base}/api/biodiversity/test-bio-report-02/read`, {
    method: 'POST',
  });
  assert.equal(marked.status, 200);
  const markedBody = await marked.json();
  assert.equal(markedBody.report.state, 'read');
  assert.ok(markedBody.report.readAt);

  const checked = await fetch(`${base}/api/biodiversity/test-bio-report-02/status`);
  const checkedReport = (await checked.json()).report;
  assert.equal(checkedReport.state, 'read');
  assert.ok(checkedReport.readAt);
});

test('rechaza reportes de biodiversidad incompletos o con categoría inválida', async () => {
  const invalidCategory = await postBiodiversityReport(
    biodiversityPayload({ id: 'test-bio-report-03', category: 'Emergencia' }),
  );
  assert.equal(invalidCategory.response.status, 400);
  assert.equal(invalidCategory.data.error, 'invalid_category');

  const noTitle = await postBiodiversityReport(
    biodiversityPayload({ id: 'test-bio-report-04', title: '' }),
  );
  assert.equal(noTitle.response.status, 400);
  assert.equal(noTitle.data.error, 'title_required');
});
