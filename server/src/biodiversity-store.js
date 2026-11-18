import fs from 'node:fs/promises';
import path from 'node:path';

export class BiodiversityStore {
  constructor(file) {
    this.file = file;
    this.reports = new Map();
    this.ready = this.#load();
    this.writeChain = Promise.resolve();
  }

  async #load() {
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.reports)) throw new Error('Formato de reportes inválido');
      for (const report of parsed.reports) {
        if (report && typeof report.id === 'string') this.reports.set(report.id, report);
      }
    } catch (error) {
      if (error.code === 'ENOENT') return;
      if (error instanceof SyntaxError) {
        const backup = `${this.file}.corrupt-${Date.now()}`;
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        await fs.rename(this.file, backup).catch(() => {});
        console.error(`[manguare] Reportes corruptos movidos a ${backup}`);
        return;
      }
      throw error;
    }
  }

  async list() {
    await this.ready;
    return [...this.reports.values()].sort((a, b) =>
      String(b.serverReceivedAt).localeCompare(String(a.serverReceivedAt)),
    );
  }

  async get(id) {
    await this.ready;
    return this.reports.get(id) ?? null;
  }

  async add(report) {
    await this.ready;
    const existing = this.reports.get(report.id);
    if (existing) return { report: existing, created: false };
    this.reports.set(report.id, report);
    await this.#persist();
    return { report, created: true };
  }

  async markRead(id, at, actor) {
    await this.ready;
    const existing = this.reports.get(id);
    if (!existing) return null;
    if (existing.readAt) return existing;
    const report = { ...existing, state: 'read', readAt: at, readBy: actor };
    this.reports.set(id, report);
    await this.#persist();
    return report;
  }

  async #persist() {
    const snapshot = JSON.stringify({ version: 1, reports: [...this.reports.values()] }, null, 2);
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
