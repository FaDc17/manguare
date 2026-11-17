import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createHandler } from '../src/app.js';
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
  server = http.createServer(createHandler({ store, staticDir }));
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

test('crea una alerta y es idempotente por id', async () => {
  const first = await postAlert(payload());
  assert.equal(first.response.status, 201);
  assert.equal(first.data.alert.id, 'test-alert-0001');
  assert.ok(first.data.alert.serverReceivedAt);
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

test('rechaza datos inválidos sin guardar', async () => {
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
  assert.equal(list.alerts.length, 1);
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
  assert.equal(data.alerts, 2);

  const traversal = await fetch(`${base}/../package.json`);
  assert.ok([403, 404].includes(traversal.status));
});

test('persiste las alertas en disco', async () => {
  const file = path.join(directory, 'alerts.json');
  const raw = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(raw.alerts.length, 2);
  assert.ok(raw.alerts.some((alert) => alert.id === 'test-alert-0001'));
});
