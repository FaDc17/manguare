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
let clock = Date.parse('2026-11-18T10:00:00.000Z');

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'manguare-sla-'));
  const staticDir = path.join(directory, 'static');
  await fs.mkdir(staticDir, { recursive: true });
  await fs.writeFile(path.join(staticDir, 'index.html'), '<html>INDEX</html>');

  const store = new AlertStore(path.join(directory, 'alerts.json'));
  server = http.createServer(
    createHandler({
      store,
      staticDir,
      now: () => new Date(clock).toISOString(),
      ackMinutes: 10,
      escalationPhone: '+51987654321',
    }),
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(directory, { recursive: true, force: true });
});

function payload(id, overrides = {}) {
  return {
    id,
    type: 'enfermedad',
    note: 'Prueba de plazo',
    community: 'Nueva Esperanza',
    deviceName: 'Celular de prueba',
    reportedBy: 'Juan',
    reporterPhone: '992066275',
    consentLocation: false,
    clientCreatedAt: new Date(clock).toISOString(),
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

async function getAlert(id) {
  return (await (await fetch(`${base}/api/alerts/${id}`)).json()).alert;
}

test('crea el plazo de acuse según la configuración', async () => {
  const { response, data } = await postAlert(payload('sla-alert-0001'));
  assert.equal(response.status, 201);
  assert.equal(data.alert.ackDeadlineAt, '2026-11-18T10:10:00.000Z');
  assert.equal(data.alert.escalatedAt, undefined);
});

test('marca la alerta como vencida al pasar el plazo', async () => {
  clock = Date.parse('2026-11-18T10:11:00.000Z');
  const list = await (await fetch(`${base}/api/alerts`)).json();
  const alert = list.alerts.find((item) => item.id === 'sla-alert-0001');
  assert.ok(alert.escalatedAt);
  assert.equal(alert.escalationCount, 1);
  assert.equal(alert.events.at(-1).type, 'escalated');
  assert.equal(alert.events.at(-1).reason, 'deadline');
});

test('responder confirma la alerta y guarda la indicación', async () => {
  const response = await fetch(`${base}/api/alerts/sla-alert-0001/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'en_camino' }),
  });
  assert.equal(response.status, 200);
  const { alert } = await response.json();
  assert.ok(alert.acknowledgedAt);
  assert.equal(alert.responses.length, 1);
  assert.equal(alert.responses[0].code, 'en_camino');
  assert.ok(alert.events.some((event) => event.type === 'received' && event.auto));
  assert.ok(alert.events.some((event) => event.type === 'response'));

  const fetched = await getAlert('sla-alert-0001');
  assert.equal(fetched.responses.length, 1);
});

test('rechaza respuestas inválidas', async () => {
  const invalidCode = await fetch(`${base}/api/alerts/sla-alert-0001/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'inventado' }),
  });
  assert.equal(invalidCode.status, 400);

  const missingMessage = await fetch(`${base}/api/alerts/sla-alert-0001/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'otra' }),
  });
  assert.equal(missingMessage.status, 400);
});

test('registra un escalamiento manual por SMS', async () => {
  clock = Date.parse('2026-11-18T10:12:00.000Z');
  await postAlert(payload('sla-alert-0002'));
  const response = await fetch(`${base}/api/alerts/sla-alert-0002/escalate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: 'sms' }),
  });
  assert.equal(response.status, 200);
  const { alert } = await response.json();
  assert.equal(alert.lastEscalationChannel, 'sms');
  assert.equal(alert.escalationCount, 1);
  assert.ok(alert.escalatedAt);
});

test('una alerta confirmada no se marca vencida', async () => {
  clock = Date.parse('2026-11-18T10:20:00.000Z');
  await postAlert(payload('sla-alert-0003'));
  await fetch(`${base}/api/alerts/sla-alert-0003/received`, { method: 'POST' });

  clock = Date.parse('2026-11-18T11:00:00.000Z');
  const alert = await getAlert('sla-alert-0003');
  assert.ok(alert.acknowledgedAt);
  assert.equal(alert.escalatedAt, undefined);
});
