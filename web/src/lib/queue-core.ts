import { getAllAlerts, putAlert } from './db';
import type {
  AlertDraft,
  AlertRecord,
  AlertState,
  ServerAlert,
  SyncResult,
} from './types';

const API = '/api';
const STATE_RANK: Record<AlertState, number> = {
  pending: 0,
  sent: 1,
  received: 2,
  canceled: 3,
};

export function newAlertId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function nowIso(): string {
  return new Date().toISOString();
}

function trim(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export async function createLocalAlert(draft: AlertDraft): Promise<AlertRecord> {
  const now = nowIso();
  const alert: AlertRecord = {
    id: newAlertId(),
    type: draft.type,
    note: trim(draft.note, 1000),
    community: trim(draft.community, 80),
    deviceName: trim(draft.deviceName, 80),
    location: draft.consentLocation ? draft.location : undefined,
    photo: draft.photo,
    consentLocation: draft.consentLocation,
    createdAt: now,
    updatedAt: now,
    state: 'pending',
    attempts: 0,
  };
  await putAlert(alert);
  return alert;
}

function toServerPayload(alert: AlertRecord) {
  return {
    id: alert.id,
    type: alert.type,
    note: alert.note,
    community: alert.community,
    deviceName: alert.deviceName,
    location: alert.consentLocation ? alert.location : undefined,
    photo: alert.photo,
    consentLocation: alert.consentLocation,
    clientCreatedAt: alert.createdAt,
  };
}

function sortAlerts(alerts: AlertRecord[]): AlertRecord[] {
  return [...alerts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function mergeServerState(
  local: AlertRecord,
  server: ServerAlert,
  fallbackState: AlertState,
): AlertRecord {
  if (local.state === 'canceled') return local;

  const nextState = server.acknowledgedAt
    ? 'received'
    : STATE_RANK[fallbackState] > STATE_RANK[local.state]
      ? fallbackState
      : local.state;

  const changed =
    nextState !== local.state ||
    server.serverReceivedAt !== local.serverReceivedAt ||
    server.acknowledgedAt !== local.acknowledgedAt;

  if (!changed) return local;

  return {
    ...local,
    state: nextState,
    serverReceivedAt: server.serverReceivedAt,
    acknowledgedAt: server.acknowledgedAt,
    updatedAt: nowIso(),
    lastError: undefined,
  };
}

async function postAlert(alert: AlertRecord): Promise<ServerAlert> {
  const response = await fetch(`${API}/alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toServerPayload(alert)),
    cache: 'no-store',
    signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(15000) : undefined,
  });

  if (!response.ok) {
    let detail = '';
    try {
      const body = (await response.json()) as { error?: string };
      detail = body.error ? ` (${body.error})` : '';
    } catch {
      // respuesta sin JSON
    }
    throw new Error(`HTTP ${response.status}${detail}`);
  }

  const data = (await response.json()) as { alert?: ServerAlert };
  if (!data.alert) throw new Error('Respuesta del servidor incompleta');
  return data.alert;
}

async function doFlush(): Promise<SyncResult> {
  const pending = sortAlerts((await getAllAlerts()).filter((a) => a.state === 'pending'));
  let sent = 0;
  let failed = 0;

  for (const alert of pending) {
    const attemptedAt = nowIso();
    try {
      const server = await postAlert(alert);
      const merged = mergeServerState(alert, server, 'sent');
      await putAlert({
        ...merged,
        attempts: alert.attempts + 1,
        lastAttemptAt: attemptedAt,
        lastError: undefined,
      });
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      await putAlert({
        ...alert,
        attempts: alert.attempts + 1,
        lastAttemptAt: attemptedAt,
        lastError: message,
        updatedAt: nowIso(),
      });
      failed += 1;
    }
  }

  return { sent, failed };
}

let activeFlush: Promise<SyncResult> | null = null;

/**
 * Envía las alertas pendientes. Es idempotente: el id se genera una sola vez y
 * el servidor devuelve la alerta existente si se reintenta.
 */
export function flushQueue(): Promise<SyncResult> {
  if (!activeFlush) {
    activeFlush = doFlush().finally(() => {
      activeFlush = null;
    });
  }
  return activeFlush;
}

/**
 * Trae el estado confirmado desde el servidor (por ejemplo, si la red de salud
 * ya marcó una alerta como recibida).
 */
export async function pullStatuses(): Promise<number> {
  const response = await fetch(`${API}/alerts`, {
    cache: 'no-store',
    signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(15000) : undefined,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = (await response.json()) as { alerts?: ServerAlert[] };
  const serverAlerts = data.alerts ?? [];
  const byId = new Map(serverAlerts.map((alert) => [alert.id, alert]));
  const localAlerts = await getAllAlerts();

  let updated = 0;
  for (const local of localAlerts) {
    const server = byId.get(local.id);
    if (!server) continue;
    const merged = mergeServerState(local, server, 'sent');
    if (merged !== local) {
      await putAlert(merged);
      updated += 1;
    }
  }
  return updated;
}

export async function syncAll(): Promise<SyncResult & { updated: number }> {
  const result = await flushQueue();
  let updated = 0;
  try {
    updated = await pullStatuses();
  } catch {
    // Sin conexión estable: se reintentará en el próximo ciclo.
  }
  return { ...result, updated };
}

export async function markSmsOpened(id: string): Promise<void> {
  const alerts = await getAllAlerts();
  const alert = alerts.find((item) => item.id === id);
  if (!alert) return;
  await putAlert({ ...alert, smsOpenedAt: nowIso(), updatedAt: nowIso() });
}

export async function listAlertsSorted(): Promise<AlertRecord[]> {
  return sortAlerts(await getAllAlerts());
}
