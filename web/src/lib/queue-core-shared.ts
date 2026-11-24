import { fetchWithTimeout } from './fetch-timeout';
import { isAttemptDue, nextAttemptAt } from './retry';
import type {
  AlertDraft,
  AlertRecord,
  AlertState,
  ServerAlert,
  SyncResult,
} from './types';

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

interface QueueStore {
  getAlert(id: string): Promise<AlertRecord | undefined>;
  getAllAlerts(): Promise<AlertRecord[]>;
  putAlert(alert: AlertRecord): Promise<void>;
}

/** La misma sincronización usa el almacén nativo en la app y IndexedDB en el worker. */
export function createQueueCore(store: QueueStore, apiUrl: (path: `/api${string}`) => string) {
  const { getAlert, getAllAlerts, putAlert } = store;

  async function createLocalAlert(draft: AlertDraft): Promise<AlertRecord> {
    const now = nowIso();
    const alert: AlertRecord = {
      id: newAlertId(),
      type: draft.type,
      isSos: draft.isSos,
      editToken: newAlertId(),
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
      editToken: alert.editToken,
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
  function mergeServerState(
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
      server.isSos !== local.isSos ||
      (!pendingDetails &&
        (server.consentLocation !== local.consentLocation ||
          JSON.stringify(server.location) !== JSON.stringify(local.location)));

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
      lastError: pendingDetails ? local.lastError : undefined,
      nextAttemptAt: undefined,
    };
  }

  async function postAlert(alert: AlertRecord): Promise<ServerAlert> {
    const response = await fetchWithTimeout(apiUrl('/api/alerts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toServerPayload(alert)),
      cache: 'no-store',
    }, 15_000);

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
        const latest = await getAlert(alert.id);
        if (!latest || latest.state !== 'pending') continue;
        const server = await postAlert(latest);
        const current = await getAlert(alert.id);
        if (!current) {
          sent += 1;
          continue;
        }
        const serverHasLatestDetails =
          server.note === current.note &&
          server.community === current.community &&
          server.photo === current.photo &&
          server.consentLocation === current.consentLocation &&
          JSON.stringify(server.location) === JSON.stringify(current.location);
        // Si se anuló durante la solicitud, el servidor confirma que sí llegó.
        const merged = mergeServerState(
          current.state === 'canceled' ? { ...current, state: 'pending' } : current,
          server,
          'sent',
        );
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
        const current = await getAlert(alert.id);
        if (!current || current.state !== 'pending') {
          failed += 1;
          continue;
        }
        const attempts = current.attempts + 1;
        await putAlert({
          ...current,
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
  function flushQueue(force = false): Promise<SyncResult> {
    if (!activeFlush) {
      activeFlush = doFlush(force).finally(() => {
        activeFlush = null;
      });
    }
    return activeFlush;
  }

  /** Quita la espera pendiente para que el próximo ciclo intente de inmediato. */
  async function resumePendingNow(): Promise<void> {
    const alerts = await getAllAlerts();
    await Promise.all(
      alerts
        .filter((alert) => alert.state === 'pending' && alert.nextAttemptAt)
        .map((alert) => putAlert({ ...alert, nextAttemptAt: undefined })),
    );
  }

  async function getServerAlert(id: string): Promise<ServerAlert | null> {
    const response = await fetchWithTimeout(apiUrl(`/api/alerts/${encodeURIComponent(id)}`), {
      cache: 'no-store',
    }, 15_000);
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
  async function pullStatuses(): Promise<number> {
    const localAlerts = (await getAllAlerts()).filter(
      (alert) => alert.state !== 'canceled' && Boolean(alert.serverReceivedAt),
    );

    let updated = 0;
    for (const local of localAlerts) {
      try {
        const server = await getServerAlert(local.id);
        if (!server) continue;
        const current = await getAlert(local.id);
        if (!current || current.state === 'canceled') continue;
        const merged = mergeServerState(current, server, 'sent');
        if (merged !== current) {
          await putAlert(merged);
          updated += 1;
        }
      } catch {
        // Se reintentará en el próximo ciclo; una alerta no bloquea a las demás.
      }
    }
    return updated;
  }

  async function syncAll(force = false): Promise<SyncResult & { updated: number }> {
    const result = await flushQueue(force);
    const failedDetails = await flushPendingDetails();
    let updated = 0;
    try {
      updated = await pullStatuses();
    } catch {
      // Sin conexión estable: se reintentará en el próximo ciclo.
    }
    return { ...result, failed: result.failed + failedDetails, updated };
  }

  async function updateAlertDetails(
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

  async function flushPendingDetails(): Promise<number> {
    const pending = (await getAllAlerts()).filter(
      (alert) => alert.detailsPendingSync && alert.serverReceivedAt,
    );
    let failed = 0;
    for (const alert of pending) {
      try {
        const response = await fetchWithTimeout(apiUrl(`/api/alerts/${encodeURIComponent(alert.id)}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            editToken: alert.editToken,
            note: alert.note,
            community: alert.community,
            location: alert.consentLocation ? alert.location : undefined,
            consentLocation: alert.consentLocation,
            photo: alert.photo,
          }),
          cache: 'no-store',
        }, 15_000);
        if (!response.ok) throw new HttpError(response.status, '');
        const data = (await response.json()) as { alert?: ServerAlert };
        if (!data.alert) throw new Error('Respuesta del servidor incompleta');
        const current = await getAlert(alert.id);
        if (!current) continue;
        const editedAgain =
          current.note !== alert.note ||
          current.community !== alert.community ||
          current.photo !== alert.photo ||
          current.consentLocation !== alert.consentLocation ||
          JSON.stringify(current.location) !== JSON.stringify(alert.location);
        const merged = mergeServerState(current, data.alert, current.state);
        await putAlert({ ...merged, detailsPendingSync: editedAgain });
      } catch (error) {
        failed += 1;
        if (error instanceof HttpError && (error.status === 403 || error.status === 409)) {
          const current = await getAlert(alert.id);
          if (!current) continue;
          await putAlert({
            ...current,
            detailsPendingSync: true,
            lastError:
              error.status === 409
                ? 'La red ya confirmó la alerta; no se puede editar.'
                : 'No se pudo editar la alerta.',
            updatedAt: nowIso(),
          });
        }
        // Los errores de red se reintentan en el próximo ciclo.
      }
    }
    return failed;
  }

  /**
   * Anula una alerta que todavía no salió del teléfono. Si ya llegó al servidor
   * no se puede retirar: la interfaz no ofrece esta acción en ese caso.
   */
  async function cancelAlert(id: string): Promise<AlertRecord | null> {
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

  async function markSmsOpened(id: string): Promise<void> {
    const alerts = await getAllAlerts();
    const alert = alerts.find((item) => item.id === id);
    if (!alert) return;
    await putAlert({ ...alert, smsOpenedAt: nowIso(), updatedAt: nowIso() });
  }

  async function listAlertsSorted(): Promise<AlertRecord[]> {
    return sortAlerts(await getAllAlerts());
  }

  return {
    createLocalAlert,
    mergeServerState,
    flushQueue,
    resumePendingNow,
    pullStatuses,
    syncAll,
    updateAlertDetails,
    cancelAlert,
    markSmsOpened,
    listAlertsSorted,
  };
}
