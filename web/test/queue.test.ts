import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { clearAlerts, getAlert } from '../src/lib/db';
import {
  cancelAlert,
  createLocalAlert,
  flushQueue,
  listAlertsSorted,
  mergeServerState,
  pullStatuses,
  resumePendingNow,
} from '../src/lib/queue-core';
import { isAttemptDue, nextAttemptAt, retryDelayMs } from '../src/lib/retry';
import type { AlertRecord, ServerAlert } from '../src/lib/types';

const realFetch = globalThis.fetch;

function serverAlert(record: AlertRecord, acknowledged = false): ServerAlert {
  return {
    id: record.id,
    type: record.type,
    note: record.note,
    community: record.community,
    deviceName: record.deviceName,
    consentLocation: record.consentLocation,
    clientCreatedAt: record.createdAt,
    serverReceivedAt: new Date().toISOString(),
    ...(acknowledged ? { acknowledgedAt: new Date().toISOString() } : {}),
  };
}

beforeEach(async () => {
  await clearAlerts();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test('la espera progresiva crece y se detiene en 5 minutos', () => {
  assert.equal(retryDelayMs(0), 0);
  assert.equal(retryDelayMs(1), 15_000);
  assert.equal(retryDelayMs(2), 45_000);
  assert.equal(retryDelayMs(3), 120_000);
  assert.equal(retryDelayMs(4), 300_000);
  assert.equal(retryDelayMs(50), 300_000);

  const scheduled = nextAttemptAt(2, 1_000_000, () => 0.5);
  assert.equal(scheduled, new Date(1_045_000).toISOString());
  assert.equal(isAttemptDue({ nextAttemptAt: scheduled }, 1_000_000), false);
  assert.equal(isAttemptDue({ nextAttemptAt: scheduled }, 1_045_000), true);
  assert.equal(isAttemptDue({}, 1_000_000), true);
});

test('el estado nunca retrocede y una alerta anulada no revive', () => {
  const base: AlertRecord = {
    id: 'merge-alert-0001',
    type: 'enfermedad',
    note: '',
    community: '',
    deviceName: '',
    consentLocation: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: 'received',
    attempts: 1,
    serverReceivedAt: new Date().toISOString(),
    acknowledgedAt: new Date().toISOString(),
  };
  const server: ServerAlert = {
    ...serverAlert(base, true),
    serverReceivedAt: base.serverReceivedAt!,
    acknowledgedAt: base.acknowledgedAt,
  };

  assert.equal(mergeServerState(base, server, 'sent'), base);

  const canceled: AlertRecord = { ...base, state: 'canceled' };
  assert.equal(mergeServerState(canceled, server, 'sent'), canceled);

  const pending: AlertRecord = {
    ...base,
    state: 'pending',
    serverReceivedAt: undefined,
    acknowledgedAt: undefined,
  };
  const pendingServer = serverAlert(pending);
  const merged = mergeServerState(pending, pendingServer, 'sent');
  assert.equal(merged.state, 'sent');
  assert.ok(merged.serverReceivedAt);
});

test('sin red la alerta queda pendiente con reintento programado y sobrevive a la recarga', async () => {
  globalThis.fetch = (async () => {
    throw new TypeError('red caída');
  }) as typeof fetch;

  const alert = await createLocalAlert({
    type: 'mordedura',
    note: 'Serpiente cerca de la chacra',
    community: 'Nueva Esperanza',
    deviceName: 'Celular de prueba',
    consentLocation: false,
  });

  const result = await flushQueue(true);
  assert.deepEqual(result, { sent: 0, failed: 1 });

  const stored = await getAlert(alert.id);
  assert.equal(stored?.state, 'pending');
  assert.equal(stored?.attempts, 1);
  assert.ok(stored?.nextAttemptAt);
  assert.match(stored?.lastError ?? '', /red caída/);

  // Simula cerrar y abrir la app: la cola se lee desde IndexedDB.
  const reloaded = await listAlertsSorted();
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].id, alert.id);

  // La espera progresiva evita reintentar antes de tiempo.
  const tooSoon = await flushQueue(false);
  assert.deepEqual(tooSoon, { sent: 0, failed: 0 });

  // Al volver la señal se ignora la espera y se envía una sola vez.
  await resumePendingNow();
  let posts = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith('/api/alerts') && init?.method === 'POST') {
      posts += 1;
      const body = JSON.parse(String(init.body)) as AlertRecord;
      return new Response(JSON.stringify({ alert: serverAlert({ ...body, id: alert.id }) }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ alerts: [] }), { status: 200 });
  }) as typeof fetch;

  const sent = await flushQueue(true);
  assert.deepEqual(sent, { sent: 1, failed: 0 });
  assert.equal(posts, 1);

  const afterSend = await getAlert(alert.id);
  assert.equal(afterSend?.state, 'sent');
  assert.equal(afterSend?.nextAttemptAt, undefined);

  // Un segundo envío no duplica: ya no está pendiente.
  await flushQueue(true);
  assert.equal(posts, 1);
});

test('la confirmación de la red de salud llega por alerta, sin descargar la lista completa', async () => {
  let created: AlertRecord | null = null;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as AlertRecord;
    created = body;
    return new Response(JSON.stringify({ alert: serverAlert(body) }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  await createLocalAlert({
    type: 'parto',
    note: '',
    community: 'Shawi',
    deviceName: 'Celular',
    consentLocation: false,
  });
  await flushQueue(true);
  assert.ok(created);

  let requestedPath = '';
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedPath = String(input);
    return new Response(
      JSON.stringify({ alert: serverAlert(created as AlertRecord, true) }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  const updated = await pullStatuses();
  assert.equal(updated, 1);
  assert.match(requestedPath, /\/api\/alerts\/[^/]+$/);

  const stored = await getAlert(created!.id);
  assert.equal(stored?.state, 'received');
  assert.ok(stored?.acknowledgedAt);
});

test('una alerta pendiente se puede anular y no se envía', async () => {
  let posts = 0;
  globalThis.fetch = (async () => {
    posts += 1;
    throw new TypeError('no debería llamarse');
  }) as typeof fetch;

  const alert = await createLocalAlert({
    type: 'otro',
    note: '',
    community: '',
    deviceName: '',
    consentLocation: false,
  });

  const canceled = await cancelAlert(alert.id);
  assert.equal(canceled?.state, 'canceled');
  assert.equal(await cancelAlert(alert.id), null);

  const result = await flushQueue(true);
  assert.deepEqual(result, { sent: 0, failed: 0 });
  assert.equal(posts, 0);

  const stored = await getAlert(alert.id);
  assert.equal(stored?.state, 'canceled');
});

test('una alerta que ya salió del teléfono no se puede anular', async () => {
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as AlertRecord;
    return new Response(JSON.stringify({ alert: serverAlert(body) }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const alert = await createLocalAlert({
    type: 'accidente',
    note: '',
    community: '',
    deviceName: '',
    consentLocation: false,
  });
  await flushQueue(true);

  assert.equal(await cancelAlert(alert.id), null);
  assert.equal((await getAlert(alert.id))?.state, 'sent');
});
