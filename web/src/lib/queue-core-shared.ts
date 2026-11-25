import { fetchWithTimeout } from './fetch-timeout';
import { isAttemptDue, nextAttemptAt } from './retry';
import type {
  AlertDraft,
  AlertRecord,
  AlertState,
  ServerAlert,
  SyncAttemptDiagnostic,
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

class AlertPostError extends Error {
  constructor(
    message: string,
    readonly endpoint: string,
    readonly requestStarted: boolean,
    readonly httpStatus?: number,
    readonly responseReceived = false,
  ) {
    super(message);
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

function errorMessage(error: unknown): string {
  const text = error instanceof Error
    ? error.name === 'Error' ? error.message : `${error.name}: ${error.message}`
    : String(error);
  return text.replace(/\s+/g, ' ').slice(0, 300);
}

function safeEndpoint(endpoint: string): string {
  if (endpoint.startsWith('/')) return endpoint.split(/[?#]/, 1)[0].slice(0, 200);
  try {
    const url = new URL(endpoint);
    return `${url.protocol}//${url.host}${url.pathname}`.slice(0, 200);
  } catch {
    return endpoint.split(/[?#]/, 1)[0].slice(0, 200);
  }
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

  interface PostedAlert {
    alert: ServerAlert;
    endpoint: string;
    httpStatus: number;
  }

  async function postAlert(alert: AlertRecord): Promise<PostedAlert> {
    let endpoint = '/api/alerts';
    try {
      endpoint = safeEndpoint(apiUrl('/api/alerts'));
    } catch (error) {
      throw new AlertPostError(errorMessage(error), endpoint, false);
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toServerPayload(alert)),
        cache: 'no-store',
      }, 15_000);
    } catch (error) {
      throw new AlertPostError(errorMessage(error), endpoint, true);
    }

    if (!response.ok) {
      let detail = '';
      try {
        const body = (await response.json()) as { error?: string };
        detail = body.error?.slice(0, 200) ?? '';
      } catch {
        // respuesta sin JSON
      }
      throw new AlertPostError(
        `HTTP ${response.status}${detail ? ` (${detail})` : ''}`,
        endpoint,
        true,
        response.status,
        true,
      );
    }

    let data: { alert?: ServerAlert };
    try {
      data = (await response.json()) as { alert?: ServerAlert };
    } catch (error) {
      throw new AlertPostError(
        `Respuesta JSON inválida: ${errorMessage(error)}`,
        endpoint,
        true,
        response.status,
        true,
      );
    }
    if (!data.alert) {
      throw new AlertPostError(
        'Respuesta HTTP recibida sin el campo alert.',
        endpoint,
        true,
        response.status,
        true,
      );
    }
    return { alert: data.alert, endpoint, httpStatus: response.status };
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
      let posted: PostedAlert | undefined;
      try {
        const latest = await getAlert(alert.id);
        if (!latest || latest.state !== 'pending') continue;
        posted = await postAlert(latest);
        const server = posted.alert;
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
          lastSyncAttempt: {
            attemptedAt,
            alertId: latest.id,
            endpoint: posted.endpoint,
            method: 'POST',
            attempt: current.attempts + 1,
            ok: true,
            requestStarted: true,
            responseReceived: true,
            httpStatus: posted.httpStatus,
            serverAlertId: server.id,
            stateBefore: latest.state,
            stateAfter: merged.state,
            error: `Respuesta recibida; ID devuelto: ${server.id}.`,
          },
        });
        sent += 1;
      } catch (error) {
        const message = errorMessage(error);
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
          lastSyncAttempt: {
            attemptedAt,
            alertId: alert.id,
            endpoint: error instanceof AlertPostError
              ? error.endpoint
              : posted?.endpoint ?? '/api/alerts',
            method: 'POST',
            attempt: attempts,
            ok: false,
            requestStarted: error instanceof AlertPostError
              ? error.requestStarted
              : Boolean(posted),
            responseReceived: error instanceof AlertPostError
              ? error.responseReceived
              : Boolean(posted),
            httpStatus: error instanceof AlertPostError
              ? error.httpStatus
              : posted?.httpStatus,
            serverAlertId: posted?.alert.id,
            stateBefore: alert.state,
            stateAfter: current.state,
            error: message,
          } satisfies SyncAttemptDiagnostic,
          updatedAt: nowIso(),
        });
        failed += 1;
      }
    }

    return { sent, failed };
  }

  let activeFlush: Promise<SyncResult> | null = null;
  let forceFlushRequested = false;

  /**
   * Envía las alertas pendientes. Es idempotente: el id se genera una sola vez y
   * el servidor devuelve la alerta existente si se reintenta.
   *
   * `force` ignora la espera progresiva; se usa al recuperar conexión o cuando la
   * persona pide un intento manual.
   */
  function flushQueue(force = false): Promise<SyncResult> {
    if (activeFlush) {
      if (force) forceFlushRequested = true;
      return activeFlush;
    }

    activeFlush = (async () => {
      let result = await doFlush(force);
      while (forceFlushRequested) {
        forceFlushRequested = false;
        const forcedResult = await doFlush(true);
        result = {
          sent: result.sent + forcedResult.sent,
          failed: result.failed + forcedResult.failed,
        };
      }
      return result;
    })().finally(() => {
      activeFlush = null;
    });
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
      const attemptedAt = nowIso();
      const attempt = alert.lastSyncAttempt?.method === 'PATCH'
        ? alert.lastSyncAttempt.attempt + 1
        : 1;
      let endpoint = `/api/alerts/${encodeURIComponent(alert.id)}`;
      let requestStarted = false;
      let responseReceived = false;
      let httpStatus: number | undefined;
      let serverAlertId: string | undefined;
      try {
        endpoint = safeEndpoint(apiUrl(`/api/alerts/${encodeURIComponent(alert.id)}`));
        requestStarted = true;
        const response = await fetchWithTimeout(endpoint, {
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
        responseReceived = true;
        httpStatus = response.status;
        if (!response.ok) {
          let detail = '';
          try {
            const body = (await response.json()) as { error?: string };
            detail = body.error?.slice(0, 200) ?? '';
          } catch {
            // respuesta sin JSON
          }
          throw new HttpError(response.status, detail);
        }
        const data = (await response.json()) as { alert?: ServerAlert };
        if (!data.alert) throw new Error('Respuesta del servidor incompleta');
        serverAlertId = data.alert.id;
        const current = await getAlert(alert.id);
        if (!current) continue;
        const editedAgain =
          current.note !== alert.note ||
          current.community !== alert.community ||
          current.photo !== alert.photo ||
          current.consentLocation !== alert.consentLocation ||
          JSON.stringify(current.location) !== JSON.stringify(alert.location);
        const merged = mergeServerState(current, data.alert, current.state);
        await putAlert({
          ...merged,
          detailsPendingSync: editedAgain,
          lastSyncAttempt: {
            attemptedAt,
            alertId: alert.id,
            endpoint,
            method: 'PATCH',
            attempt,
            ok: true,
            requestStarted,
            responseReceived,
            httpStatus,
            serverAlertId,
            stateBefore: alert.state,
            stateAfter: merged.state,
            error: `Respuesta recibida; ID devuelto: ${data.alert.id}.`,
          },
        });
      } catch (error) {
        failed += 1;
        const detail = error instanceof HttpError && error.status === 409
          ? `${errorMessage(error)}: La red ya confirmó la alerta; no se puede editar.`
          : error instanceof HttpError && error.status === 403
            ? `${errorMessage(error)}: No se pudo editar la alerta.`
            : errorMessage(error);
        const current = await getAlert(alert.id);
        if (!current) continue;
        await putAlert({
          ...current,
          detailsPendingSync: true,
          lastError: detail,
          lastSyncAttempt: {
            attemptedAt,
            alertId: alert.id,
            endpoint,
            method: 'PATCH',
            attempt,
            ok: false,
            requestStarted,
            responseReceived,
            httpStatus,
            serverAlertId,
            stateBefore: alert.state,
            stateAfter: current.state,
            error: detail,
          },
          updatedAt: nowIso(),
        });
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
