import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Almacén mínimo de alertas respaldado por un archivo JSON.
 * Suficiente para el MVP y para que el panel sobreviva a reinicios.
 */
export class AlertStore {
  constructor(file) {
    this.file = file;
    this.alerts = new Map();
    this.ready = this.#load();
    this.writeChain = Promise.resolve();
  }

  async #load() {
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      const rows = Array.isArray(parsed) ? parsed : parsed.alerts;
      if (!Array.isArray(rows)) throw new Error('Formato de datos inválido');
      for (const alert of rows) {
        if (alert && typeof alert.id === 'string') {
          this.alerts.set(alert.id, alert);
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') return;
      if (error instanceof SyntaxError) {
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

  async acknowledge(id, acknowledgedAt, actor) {
    await this.ready;
    const existing = this.alerts.get(id);
    if (!existing) return null;
    if (existing.acknowledgedAt) return existing;
    const events = Array.isArray(existing.events) ? existing.events : [];
    const updated = {
      ...existing,
      acknowledgedAt,
      ...(actor ? { acknowledgedBy: actor } : {}),
      events: [
        ...events,
        {
          type: 'received',
          at: acknowledgedAt,
          ...(actor ? { by: actor } : {}),
        },
      ],
    };
    this.alerts.set(id, updated);
    await this.#persist();
    return updated;
  }

  async #persist() {
    const snapshot = JSON.stringify(
      { version: 1, alerts: [...this.alerts.values()] },
      null,
      2,
    );
    const run = this.writeChain.then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const temp = `${this.file}.tmp`;
      await fs.writeFile(temp, snapshot, 'utf8');
      await fs.rename(temp, this.file);
    });
    this.writeChain = run.catch(() => {});
    return run;
  }
}
