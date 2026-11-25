import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { clearAlerts, getAlert, putAlert } from '../src/lib/db';
import {
  cancelAlert,
  createLocalAlert,
  flushQueue,
  listAlertsSorted,
  mergeServerState,
  pullStatuses,
  resumePendingNow,
  syncAll,
  updateAlertDetails,
} from '../src/lib/queue-core';
import { isAttemptDue, nextAttemptAt, retryDelayMs } from '../src/lib/retry';
import { syncAll as syncWorker } from '../src/lib/queue-worker';
import type { AlertRecord, ServerAlert } from '../src/lib/types';

const realFetch = globalThis.fetch;

function serverAlert(record: AlertRecord, acknowledged = false): ServerAlert {
  return {
    id: record.id,
    type: record.type,
    note: record.note,
    community: record.community,
    isSos: record.isSos,
    photo: record.photo,
    location: record.location,
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
  assert.deepEqual(stored?.lastSyncAttempt, {
    attemptedAt: stored?.lastAttemptAt,
    alertId: alert.id,
    endpoint: '/api/alerts',
    method: 'POST',
    attempt: 1,
    ok: false,
    requestStarted: true,
    responseReceived: false,
    httpStatus: undefined,
    serverAlertId: undefined,
    stateBefore: 'pending',
    stateAfter: 'pending',
    error: 'TypeError: red caída',
  });

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
  assert.equal(afterSend?.lastSyncAttempt?.httpStatus, 201);
  assert.equal(afterSend?.lastSyncAttempt?.ok, true);
  assert.equal(afterSend?.lastSyncAttempt?.responseReceived, true);
  assert.equal(afterSend?.lastSyncAttempt?.serverAlertId, alert.id);
  assert.equal(afterSend?.lastSyncAttempt?.stateAfter, 'sent');

  // Un segundo envío no duplica: ya no está pendiente.
  await flushQueue(true);
  assert.equal(posts, 1);
});

test('guarda el código HTTP y el error del backend en el diagnóstico visible', async () => {
  const alert = await createLocalAlert({
    type: 'otro',
    note: 'Prueba de respuesta HTTP',
    community: 'Chiriaco',
    deviceName: 'Celular de prueba',
    consentLocation: false,
  });
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ error: 'storage_write_failed' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  )) as typeof fetch;

  const result = await flushQueue(true);
  assert.deepEqual(result, { sent: 0, failed: 1 });
  const stored = await getAlert(alert.id);
  assert.equal(stored?.state, 'pending');
  assert.equal(stored?.lastSyncAttempt?.httpStatus, 503);
  assert.equal(stored?.lastSyncAttempt?.ok, false);
  assert.equal(stored?.lastSyncAttempt?.requestStarted, true);
  assert.equal(stored?.lastSyncAttempt?.responseReceived, true);
  assert.equal(stored?.lastSyncAttempt?.error, 'HTTP 503 (storage_write_failed)');
});

test('una solicitud forzada durante otro envío reintenta también las alertas en espera', async () => {
  const active = await createLocalAlert({
    type: 'otro',
    note: 'Envío activo',
    community: 'Chiriaco',
    deviceName: 'Celular de prueba',
    consentLocation: false,
  });
  const delayed = await createLocalAlert({
    type: 'otro',
    note: 'Alerta con reintento programado',
    community: 'Chiriaco',
    deviceName: 'Celular de prueba',
    consentLocation: false,
  });
  await putAlert({
    ...delayed,
    attempts: 1,
    nextAttemptAt: new Date(Date.now() + 60_000).toISOString(),
  });

  let releaseActive!: (response: Response) => void;
  let signalActiveStarted!: () => void;
  const activeResponse = new Promise<Response>((resolve) => {
    releaseActive = resolve;
  });
  const activeStarted = new Promise<void>((resolve) => {
    signalActiveStarted = resolve;
  });
  const postedIds: string[] = [];
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as AlertRecord;
    postedIds.push(body.id);
    if (body.id === active.id && postedIds.filter((id) => id === active.id).length === 1) {
      signalActiveStarted();
      return activeResponse;
    }
    const alert = await getAlert(body.id);
    assert.ok(alert);
    return new Response(JSON.stringify({ alert: serverAlert(alert) }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const normalFlush = flushQueue(false);
  await activeStarted;
  const forcedFlush = flushQueue(true);
  releaseActive(new Response(JSON.stringify({ alert: serverAlert(active) }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  }));

  await Promise.all([normalFlush, forcedFlush]);
  assert.equal(postedIds.filter((id) => id === delayed.id).length, 1);
  assert.equal((await getAlert(delayed.id))?.state, 'sent');
});

test('guarda y sincroniza una alerta aunque no se haya obtenido ubicación', async () => {
  let payload: Record<string, unknown> | undefined;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const alert = await getAlert(String(payload.id));
    assert.ok(alert);
    return new Response(JSON.stringify({ alert: serverAlert(alert) }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const alert = await createLocalAlert({
    type: 'otro',
    note: 'Sin coordenadas GPS',
    community: 'Chiriaco',
    deviceName: 'Celular de prueba',
    consentLocation: true,
  });
  assert.equal((await getAlert(alert.id))?.state, 'pending');

  const result = await flushQueue(true);
  assert.deepEqual(result, { sent: 1, failed: 0 });
  assert.ok(payload);
  assert.equal('location' in payload, false);
  assert.equal((await getAlert(alert.id))?.state, 'sent');
});

test('el worker sincroniza la cola PWA en IndexedDB con rutas API relativas', async () => {
  const alert = await createLocalAlert({
    type: 'otro', note: 'Aviso sin conexión', community: 'Prueba',
    deviceName: 'Navegador', consentLocation: false,
  });
  const server = serverAlert(alert);
  const paths: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    paths.push(String(input));
    return new Response(JSON.stringify({ alert: server }), { status: 200 });
  }) as typeof fetch;

  assert.deepEqual(await syncWorker(true), { sent: 1, failed: 0, updated: 0 });
  assert.deepEqual(paths, ['/api/alerts', `/api/alerts/${alert.id}`]);
  assert.equal((await getAlert(alert.id))?.state, 'sent');
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
  const responseAt = new Date().toISOString();
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedPath = String(input);
    return new Response(
      JSON.stringify({
        alert: {
          ...serverAlert(created as AlertRecord, true),
          responses: [{ code: 'en_camino', at: responseAt, by: 'salud' }],
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  const updated = await pullStatuses();
  assert.equal(updated, 1);
  assert.match(requestedPath, /\/api\/alerts\/[^/]+$/);

  const stored = await getAlert(created!.id);
  assert.equal(stored?.state, 'received');
  assert.ok(stored?.acknowledgedAt);
  assert.equal(stored?.responses?.[0].code, 'en_camino');
  assert.equal(stored?.responses?.[0].at, responseAt);
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

test('un envío confirmado después de anular no queda falsamente anulado', async () => {
  let started!: () => void;
  let finish!: (response: Response) => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  const pendingResponse = new Promise<Response>((resolve) => { finish = resolve; });
  globalThis.fetch = (async () => { started(); return pendingResponse; }) as typeof fetch;
  const alert = await createLocalAlert({ type: 'otro', note: '', community: '', deviceName: '', consentLocation: false });
  const flush = flushQueue(true);
  await entered;
  assert.equal((await cancelAlert(alert.id))?.state, 'canceled');
  finish(new Response(JSON.stringify({ alert: serverAlert(alert) }), { status: 201 }));
  await flush;
  assert.equal((await getAlert(alert.id))?.state, 'sent');
});

test('un fallo de envío no sobrescribe detalles editados durante la solicitud', async () => {
  let started!: () => void;
  let fail!: (error: Error) => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  const pendingResponse = new Promise<Response>((_resolve, reject) => { fail = reject; });
  globalThis.fetch = (async () => { started(); return pendingResponse; }) as typeof fetch;
  const alert = await createLocalAlert({ type: 'otro', note: 'Original', community: '', deviceName: '', consentLocation: false });
  const flush = flushQueue(true);
  await entered;
  await updateAlertDetails(alert.id, { note: 'Detalle nuevo', community: 'Comunidad', photo: undefined });
  fail(new Error('red interrumpida'));
  await flush;
  const stored = await getAlert(alert.id);
  assert.equal(stored?.state, 'pending');
  assert.equal(stored?.note, 'Detalle nuevo');
  assert.equal(stored?.community, 'Comunidad');
});

test('la consulta del servidor conserva una edición local hecha durante la solicitud', async () => {
  const alert = await createLocalAlert({
    type: 'otro', isSos: true, note: 'Original', community: '', deviceName: '', consentLocation: false,
  });
  globalThis.fetch = (async () => new Response(JSON.stringify({ alert: serverAlert(alert) }), { status: 201 })) as typeof fetch;
  await flushQueue(true);

  let started!: () => void;
  let finish!: (response: Response) => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  const pendingResponse = new Promise<Response>((resolve) => { finish = resolve; });
  globalThis.fetch = (async () => { started(); return pendingResponse; }) as typeof fetch;
  const pull = pullStatuses();
  await entered;
  await updateAlertDetails(alert.id, { note: 'Edición reciente', community: '', photo: undefined });
  finish(new Response(JSON.stringify({ alert: serverAlert(alert) }), { status: 200 }));
  await pull;
  const stored = await getAlert(alert.id);
  assert.equal(stored?.note, 'Edición reciente');
  assert.equal(stored?.detailsPendingSync, true);
});

test('una segunda edición durante PATCH queda pendiente de sincronizar', async () => {
  const alert = await createLocalAlert({
    type: 'otro', isSos: true, note: 'Original', community: '', deviceName: '', consentLocation: false,
  });
  globalThis.fetch = (async () => new Response(JSON.stringify({ alert: serverAlert(alert) }), { status: 201 })) as typeof fetch;
  await flushQueue(true);
  await updateAlertDetails(alert.id, { note: 'Primera edición', community: '', photo: undefined });

  let started!: () => void;
  let finish!: (response: Response) => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  const pendingResponse = new Promise<Response>((resolve) => { finish = resolve; });
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'PATCH') { started(); return pendingResponse; }
    return new Response(JSON.stringify({ alert: serverAlert(alert) }), { status: 200 });
  }) as typeof fetch;
  const sync = syncAll(true);
  await entered;
  await updateAlertDetails(alert.id, { note: 'Segunda edición', community: '', photo: undefined });
  finish(new Response(JSON.stringify({ alert: { ...serverAlert(alert), note: 'Primera edición' } }), { status: 200 }));
  await sync;
  const stored = await getAlert(alert.id);
  assert.equal(stored?.note, 'Segunda edición');
  assert.equal(stored?.detailsPendingSync, true);
});

test('un detalle rechazado no aparece como sincronizado', async () => {
  const alert = await createLocalAlert({
    type: 'otro', isSos: true, note: 'Original', community: '', deviceName: '', consentLocation: false,
  });
  globalThis.fetch = (async () => new Response(JSON.stringify({ alert: serverAlert(alert) }), { status: 201 })) as typeof fetch;
  await flushQueue(true);
  await updateAlertDetails(alert.id, { note: 'Detalle pendiente', community: '', photo: undefined });
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'PATCH') return new Response(null, { status: 409 });
    return new Response(JSON.stringify({ alert: serverAlert(alert, true) }), { status: 200 });
  }) as typeof fetch;
  const result = await syncAll(true);
  assert.equal(result.failed, 1);
  const stored = await getAlert(alert.id);
  assert.equal(stored?.note, 'Detalle pendiente');
  assert.equal(stored?.detailsPendingSync, true);
  assert.match(stored?.lastError ?? '', /no se puede editar/);
  assert.equal(stored?.lastSyncAttempt?.method, 'PATCH');
  assert.equal(stored?.lastSyncAttempt?.httpStatus, 409);
  assert.equal(stored?.lastSyncAttempt?.responseReceived, true);
});

test('un cambio remoto solo de ubicación actualiza la alerta local', async () => {
  const alert = await createLocalAlert({
    type: 'otro', note: '', community: '', deviceName: '', consentLocation: false,
  });
  const local: AlertRecord = { ...alert, state: 'sent', serverReceivedAt: '2026-11-22T00:00:00.000Z' };
  const location = { lat: -3.75, lng: -73.25, accuracy: 12, capturedAt: '2026-11-22T00:00:00.000Z' };
  const server: ServerAlert = {
    ...serverAlert(local), serverReceivedAt: local.serverReceivedAt!,
    consentLocation: true, location,
  };
  const merged = mergeServerState(local, server, 'sent');
  assert.equal(merged.consentLocation, true);
  assert.deepEqual(merged.location, location);
});
