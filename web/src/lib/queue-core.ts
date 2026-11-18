import { getAlert, getAllAlerts, putAlert } from './db';
import { isAttemptDue, nextAttemptAt } from './retry';
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

class HttpError extends Error {
  status: number;

  constructor(status: number, detail: string) {
    super(`HTTP ${status}${detail ? ` (${detail})` : ''}`);
    this.status = status;
  }
}

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
    isSos: draft.isSos,
    note: trim(draft.note, 1000),
    community: trim(draft.community, 80),
    deviceName: trim(draft.deviceName, 80),
    reportedBy: draft.reportedBy ? trim(draft.reportedBy, 80) : undefined,
    reporterPhone: draft.reporterPhone ? trim(draft.reporterPhone, 30) : undefined,
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
    isSos: alert.isSos,
    note: alert.note,
    community: alert.community,
    deviceName: alert.deviceName,
    reportedBy: alert.reportedBy,
    reporterPhone: alert.reporterPhone,
    location: alert.consentLocation ? alert.location : undefined,
    photo: alert.photo,
    consentLocation: alert.consentLocation,
    clientCreatedAt: alert.createdAt,
  };
}

function sortAlerts(alerts: AlertRecord[]): AlertRecord[] {
  return [...alerts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Combina el estado del servidor con el local sin retroceder nunca.
 * Exportada para las pruebas del núcleo offline.
 */
export function mergeServerState(
  local: AlertRecord,
  server: ServerAlert,
  fallbackState: AlertState,
): AlertRecord {
  if (local.state === 'canceled') return local;
  const pendingDetails = local.detailsPendingSync === true;

  const nextState = server.acknowledgedAt
    ? 'received'
    : STATE_RANK[fallbackState] > STATE_RANK[local.state]
      ? fallbackState
      : local.state;

  const changed =
    nextState !== local.state ||
    server.serverReceivedAt !== local.serverReceivedAt ||
    server.acknowledgedAt !== local.acknowledgedAt ||
    server.ackDeadlineAt !== local.ackDeadlineAt ||
    server.escalatedAt !== local.escalatedAt ||
    (server.responses?.length ?? 0) !== (local.responses?.length ?? 0) ||
    server.responses?.at(-1)?.at !== local.responses?.at(-1)?.at ||
    (!pendingDetails &&
      (server.note !== local.note ||
        server.community !== local.community ||
        server.photo !== local.photo)) ||
    server.isSos !== local.isSos;

  if (!changed) return local;

  return {
    ...local,
    note: pendingDetails ? local.note : server.note,
    community: pendingDetails ? local.community : server.community,
    photo: pendingDetails ? local.photo : server.photo,
    location: pendingDetails ? local.location : server.location,
    consentLocation: pendingDetails ? local.consentLocation : server.consentLocation,
    isSos: server.isSos,
    state: nextState,
    serverReceivedAt: server.serverReceivedAt,
    acknowledgedAt: server.acknowledgedAt,
    acknowledgedBy: server.acknowledgedBy,
    ackDeadlineAt: server.ackDeadlineAt,
    escalatedAt: server.escalatedAt,
    responses: server.responses,
    updatedAt: nowIso(),
    lastError: undefined,
    nextAttemptAt: undefined,
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
      detail = body.error ?? '';
    } catch {
      // respuesta sin JSON
    }
    throw new HttpError(response.status, detail);
  }

  const data = (await response.json()) as { alert?: ServerAlert };
  if (!data.alert) throw new Error('Respuesta del servidor incompleta');
  return data.alert;
}

async function doFlush(force: boolean): Promise<SyncResult> {
  const now = Date.now();
  const pending = sortAlerts(
    (await getAllAlerts()).filter(
      (alert) => alert.state === 'pending' && (force || isAttemptDue(alert, now)),
    ),
  );
  let sent = 0;
  let failed = 0;

  for (const alert of pending) {
    const attemptedAt = nowIso();
    try {
      const server = await postAlert(alert);
      const current = (await getAlert(alert.id)) ?? alert;
      const serverHasLatestDetails =
        server.note === current.note &&
        server.community === current.community &&
        server.photo === current.photo &&
        server.consentLocation === current.consentLocation &&
        JSON.stringify(server.location) === JSON.stringify(current.location);
      const merged = mergeServerState(current, server, 'sent');
      await putAlert({
        ...merged,
        detailsPendingSync: !serverHasLatestDetails,
        attempts: current.attempts + 1,
        lastAttemptAt: attemptedAt,
        lastError: undefined,
        nextAttemptAt: undefined,
      });
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      const attempts = alert.attempts + 1;
      await putAlert({
        ...alert,
        attempts,
        lastAttemptAt: attemptedAt,
        nextAttemptAt: nextAttemptAt(attempts),
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
 *
 * `force` ignora la espera progresiva; se usa al recuperar conexión o cuando la
 * persona pide un intento manual.
 */
export function flushQueue(force = false): Promise<SyncResult> {
  if (!activeFlush) {
    activeFlush = doFlush(force).finally(() => {
      activeFlush = null;
    });
  }
  return activeFlush;
}

/** Quita la espera pendiente para que el próximo ciclo intente de inmediato. */
export async function resumePendingNow(): Promise<void> {
  const alerts = await getAllAlerts();
  await Promise.all(
    alerts
      .filter((alert) => alert.state === 'pending' && alert.nextAttemptAt)
      .map((alert) => putAlert({ ...alert, nextAttemptAt: undefined })),
  );
}

async function getServerAlert(id: string): Promise<ServerAlert | null> {
  const response = await fetch(`${API}/alerts/${encodeURIComponent(id)}`, {
    cache: 'no-store',
    signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(15000) : undefined,
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new HttpError(response.status, '');
  const data = (await response.json()) as { alert?: ServerAlert };
  return data.alert ?? null;
}

/**
 * Trae el estado confirmado desde el servidor consultando solo las alertas de
 * este teléfono. No descarga la lista completa de la red de salud: es más
 * liviano y no expone alertas de otras comunidades.
 */
export async function pullStatuses(): Promise<number> {
  const localAlerts = (await getAllAlerts()).filter(
    (alert) => alert.state !== 'canceled' && Boolean(alert.serverReceivedAt),
  );

  let updated = 0;
  for (const local of localAlerts) {
    try {
      const server = await getServerAlert(local.id);
      if (!server) continue;
      const merged = mergeServerState(local, server, 'sent');
      if (merged !== local) {
        await putAlert(merged);
        updated += 1;
      }
    } catch {
      // Se reintentará en el próximo ciclo; una alerta no bloquea a las demás.
    }
  }
  return updated;
}

export async function syncAll(force = false): Promise<SyncResult & { updated: number }> {
  const result = await flushQueue(force);
  await flushPendingDetails();
  let updated = 0;
  try {
    updated = await pullStatuses();
  } catch {
    // Sin conexión estable: se reintentará en el próximo ciclo.
  }
  return { ...result, updated };
}

export async function updateAlertDetails(
  id: string,
  details: {
    note: string;
    community: string;
    location?: AlertRecord['location'];
    photo?: string;
  },
): Promise<AlertRecord> {
  const alert = await getAlert(id);
  if (!alert) throw new Error('No se encontró la alerta que deseas completar.');
  const updated: AlertRecord = {
    ...alert,
    ...details,
    consentLocation: Boolean(details.location),
    detailsPendingSync: true,
    updatedAt: nowIso(),
  };
  await putAlert(updated);
  return updated;
}

async function flushPendingDetails(): Promise<void> {
  const pending = (await getAllAlerts()).filter(
    (alert) => alert.detailsPendingSync && alert.serverReceivedAt,
  );
  for (const alert of pending) {
    try {
      const response = await fetch(`${API}/alerts/${encodeURIComponent(alert.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: alert.note,
          community: alert.community,
          location: alert.consentLocation ? alert.location : undefined,
          consentLocation: alert.consentLocation,
          photo: alert.photo,
        }),
        cache: 'no-store',
      });
      if (!response.ok) throw new HttpError(response.status, '');
      const data = (await response.json()) as { alert?: ServerAlert };
      if (!data.alert) throw new Error('Respuesta del servidor incompleta');
      const merged = mergeServerState(alert, data.alert, alert.state);
      await putAlert({ ...merged, detailsPendingSync: false });
    } catch {
      // Se reintentará junto con las demás actualizaciones en el próximo ciclo.
    }
  }
}

/**
 * Anula una alerta que todavía no salió del teléfono. Si ya llegó al servidor
 * no se puede retirar: la interfaz no ofrece esta acción en ese caso.
 */
export async function cancelAlert(id: string): Promise<AlertRecord | null> {
  const alerts = await getAllAlerts();
  const alert = alerts.find((item) => item.id === id);
  if (!alert || alert.state !== 'pending' || alert.serverReceivedAt) return null;
  const canceled: AlertRecord = {
    ...alert,
    state: 'canceled',
    nextAttemptAt: undefined,
    updatedAt: nowIso(),
  };
  await putAlert(canceled);
  return canceled;
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
