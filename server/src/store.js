import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_EVENTS = 50;
const MAX_RESPONSES = 20;

function appendEvent(events, event) {
  return [...(Array.isArray(events) ? events : []), event].slice(-MAX_EVENTS);
}

/**
 * Almacén mínimo de alertas respaldado por un archivo JSON.
 * Suficiente para el MVP y para que el panel sobreviva a reinicios.
 */
export class AlertStore {
  constructor(file, { storage = null } = {}) {
    this.file = file;
    this.storage = storage;
    this.alerts = new Map();
    this.ready = this.#load();
    this.writeChain = Promise.resolve();
  }

  async #load() {
    try {
      const parsed = this.storage
        ? await this.storage.load()
        : JSON.parse(await fs.readFile(this.file, 'utf8'));
      this.alerts.clear();
      if (!parsed) return;
      const rows = Array.isArray(parsed) ? parsed : parsed.alerts;
      if (!Array.isArray(rows)) throw new Error('Formato de datos inválido');
      for (const alert of rows) {
        if (alert && typeof alert.id === 'string') {
          this.alerts.set(alert.id, alert);
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') return;
      if (!this.storage && error instanceof SyntaxError) {
        const backup = `${this.file}.corrupt-${Date.now()}`;
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        await fs.rename(this.file, backup).catch(() => {});
        console.error(`[manguare] Datos corruptos movidos a ${backup}`);
        return;
      }
      throw error;
    }
  }

  async list() {
    await this.ready;
    return [...this.alerts.values()].sort((a, b) =>
      String(b.serverReceivedAt ?? '').localeCompare(String(a.serverReceivedAt ?? '')),
    );
  }

  async get(id) {
    await this.ready;
    return this.alerts.get(id) ?? null;
  }

  async add(alert) {
    await this.ready;
    const existing = this.alerts.get(alert.id);
    if (existing) return { alert: existing, created: false };
    this.alerts.set(alert.id, alert);
    await this.#persist();
    return { alert, created: true };
  }

  async updateDetails(id, details, at = new Date().toISOString()) {
    await this.ready;
    const existing = this.alerts.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      note: details.note,
      community: details.community,
      consentLocation: details.consentLocation,
      ...(details.consentLocation && details.location ? { location: details.location } : {}),
      ...(!details.consentLocation || !details.location ? { location: undefined } : {}),
      ...(details.photo ? { photo: details.photo } : { photo: undefined }),
      events: appendEvent(existing.events, { type: 'details', at }),
    };
    this.alerts.set(id, updated);
    await this.#persist();
    return updated;
  }

  async acknowledge(id, acknowledgedAt, actor) {
    await this.ready;
    const existing = this.alerts.get(id);
    if (!existing) return null;
    if (existing.acknowledgedAt) return existing;
    const updated = {
      ...existing,
      acknowledgedAt,
      ...(actor ? { acknowledgedBy: actor } : {}),
      events: appendEvent(existing.events, {
        type: 'received',
        at: acknowledgedAt,
        ...(actor ? { by: actor } : {}),
      }),
    };
    this.alerts.set(id, updated);
    await this.#persist();
    return updated;
  }

  /**
   * Marca como escaladas las alertas que pasaron su plazo sin confirmación.
   * No envía SMS: deja la alerta lista para que el panel avise por el canal
   * acordado. Devuelve cuántas cambiaron.
   */
  async escalateOverdue(at) {
    await this.ready;
    const now = Date.parse(at);
    if (Number.isNaN(now)) return 0;

    let changed = 0;
    for (const [id, alert] of this.alerts) {
      if (alert.acknowledgedAt || alert.escalatedAt || !alert.ackDeadlineAt) continue;
      const deadline = Date.parse(alert.ackDeadlineAt);
      if (Number.isNaN(deadline) || deadline > now) continue;
      const updated = {
        ...alert,
        escalatedAt: at,
        escalationCount: (alert.escalationCount ?? 0) + 1,
        events: appendEvent(alert.events, {
          type: 'escalated',
          at,
          reason: 'deadline',
        }),
      };
      this.alerts.set(id, updated);
      changed += 1;
    }
    if (changed > 0) await this.#persist();
    return changed;
  }

  /** Registra un escalamiento manual (por ejemplo, abrir el SMS de respaldo). */
  async escalate(id, at, actor, channel = 'manual') {
    await this.ready;
    const existing = this.alerts.get(id);
    if (!existing) return null;
    if (existing.acknowledgedAt) return existing;

    const updated = {
      ...existing,
      escalatedAt: existing.escalatedAt ?? at,
      escalationCount: (existing.escalationCount ?? 0) + 1,
      lastEscalationChannel: channel,
      events: appendEvent(existing.events, {
        type: 'escalated',
        at,
        channel,
        ...(actor ? { by: actor } : {}),
      }),
    };
    this.alerts.set(id, updated);
    await this.#persist();
    return updated;
  }

  /**
   * Guarda una respuesta de la red de salud. Responder implica haber recibido
   * la alerta, así que también la confirma si todavía no estaba confirmada.
   */
  async respond(id, { code, message }, at, actor) {
    await this.ready;
    const existing = this.alerts.get(id);
    if (!existing) return null;

    let events = Array.isArray(existing.events) ? existing.events : [];
    let acknowledgedAt = existing.acknowledgedAt;
    let acknowledgedBy = existing.acknowledgedBy;

    if (!acknowledgedAt) {
      acknowledgedAt = at;
      acknowledgedBy = actor;
      events = appendEvent(events, {
        type: 'received',
        at,
        ...(actor ? { by: actor } : {}),
        auto: true,
      });
    }

    const response = {
      code,
      at,
      ...(message ? { message } : {}),
      ...(actor ? { by: actor } : {}),
    };
    events = appendEvent(events, {
      type: 'response',
      code,
      at,
      ...(actor ? { by: actor } : {}),
    });

    const updated = {
      ...existing,
      acknowledgedAt,
      ...(acknowledgedBy ? { acknowledgedBy } : {}),
      responses: [...(existing.responses ?? []), response].slice(-MAX_RESPONSES),
      events,
    };
    this.alerts.set(id, updated);
    await this.#persist();
    return updated;
  }

  async #persist() {
    const state = { version: 1, alerts: [...this.alerts.values()] };
    const run = this.writeChain.then(async () => {
      if (this.storage) {
        try {
          await this.storage.save(state);
        } catch (error) {
          await this.#load();
          throw error;
        }
        return;
      }
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const temp = `${this.file}.tmp`;
      await fs.writeFile(temp, JSON.stringify(state, null, 2), 'utf8');
      await fs.rename(temp, this.file);
    });
    this.writeChain = run.catch(() => {});
    return run;
  }
}
