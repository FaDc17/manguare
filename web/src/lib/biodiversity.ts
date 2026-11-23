import {
  getBiodiversityReport,
  getAllBiodiversityReports,
  putBiodiversityReport,
} from './db';
import { newAlertId } from './queue-core';
import { fetchWithTimeout } from './fetch-timeout';
import { apiUrl } from './api-url';
import type {
  BiodiversityReport,
  BiodiversityReportDraft,
  ServerBiodiversityReport,
} from './types';


function nowIso(): string {
  return new Date().toISOString();
}

export async function createLocalBiodiversityReport(
  draft: BiodiversityReportDraft,
): Promise<BiodiversityReport> {
  const now = nowIso();
  const report: BiodiversityReport = {
    ...draft,
    id: newAlertId(),
    createdAt: now,
    updatedAt: now,
    state: 'pending',
    attempts: 0,
  };
  await putBiodiversityReport(report);
  return report;
}

async function postReport(report: BiodiversityReport): Promise<ServerBiodiversityReport> {
  const response = await fetchWithTimeout(apiUrl('/api/biodiversity'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: report.id,
      category: report.category,
      title: report.title,
      description: report.description,
      photo: report.photo,
      location: report.location,
      community: report.community,
      reportedBy: report.reportedBy,
      clientCreatedAt: report.createdAt,
    }),
    cache: 'no-store',
  }, 15_000);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as { report?: ServerBiodiversityReport };
  if (!data.report) throw new Error('Respuesta incompleta al enviar el reporte.');
  return data.report;
}

export async function syncBiodiversityReports(): Promise<{
  sent: number;
  failed: number;
  updated: number;
}> {
  const reports = await getAllBiodiversityReports();
  let sent = 0;
  let failed = 0;
  let updated = 0;

  for (const report of reports) {
    let current = report;
    if (current.state === 'pending') {
      try {
        const latest = await getBiodiversityReport(current.id);
        if (!latest || latest.state !== 'pending') continue;
        const server = await postReport(latest);
        const saved = await getBiodiversityReport(current.id);
        if (!saved) continue;
        current = saved;
        if (saved.state === 'pending') {
          current = {
            ...saved,
            state: server.state,
            serverReceivedAt: server.serverReceivedAt,
            readAt: server.readAt,
            attempts: saved.attempts + 1,
            lastError: undefined,
            updatedAt: nowIso(),
          };
          await putBiodiversityReport(current);
          sent += 1;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        const saved = await getBiodiversityReport(current.id);
        if (!saved || saved.state !== 'pending') continue;
        await putBiodiversityReport({
          ...saved,
          attempts: saved.attempts + 1,
          lastError: message,
          updatedAt: nowIso(),
        });
        failed += 1;
        continue;
      }
    }

    if (current.state !== 'sent') continue;
    try {
      const response = await fetchWithTimeout(apiUrl(`/api/biodiversity/${encodeURIComponent(current.id)}/status`), {
        cache: 'no-store',
      }, 15_000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { report?: ServerBiodiversityReport };
      if (!data.report) throw new Error('Respuesta incompleta al consultar el reporte.');
      if (data.report.state === 'read') {
        const saved = await getBiodiversityReport(current.id);
        if (!saved || saved.state !== 'sent') continue;
        await putBiodiversityReport({
          ...saved,
          state: 'read',
          readAt: data.report.readAt,
          updatedAt: nowIso(),
        });
        updated += 1;
      }
    } catch {
      // El siguiente ciclo vuelve a consultar el estado sin bloquear otros reportes.
    }
  }

  return { sent, failed, updated };
}
