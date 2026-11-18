import type { AlertRecord, AlertResponse } from './types';

export interface ResponseOption {
  code: string;
  label: string;
  short: string;
}

export const RESPONSE_OPTIONS: ResponseOption[] = [
  {
    code: 'en_camino',
    label: 'Ambulancia o brigada en camino',
    short: 'En camino',
  },
  {
    code: 'acudir_posta',
    label: 'Acude a la posta o centro de salud',
    short: 'Acudir a la posta',
  },
  {
    code: 'sin_medico',
    label: 'Sin personal médico: coordinar traslado',
    short: 'Coordinar traslado',
  },
  {
    code: 'otra',
    label: 'Otra indicación de la red',
    short: 'Otra indicación',
  },
];

export function responseText(response: AlertResponse): string {
  if (response.message) return response.message;
  return RESPONSE_OPTIONS.find((item) => item.code === response.code)?.label ?? 'Respuesta de la red';
}

export function isOverdue(alert: AlertRecord, now: number = Date.now()): boolean {
  if (alert.acknowledgedAt || alert.state === 'canceled' || alert.state === 'received') return false;
  if (!alert.ackDeadlineAt) return false;
  const deadline = Date.parse(alert.ackDeadlineAt);
  return !Number.isNaN(deadline) && deadline <= now;
}

export function deadlineText(alert: AlertRecord): string | null {
  if (!alert.ackDeadlineAt) return null;
  const deadline = new Date(alert.ackDeadlineAt);
  if (Number.isNaN(deadline.getTime())) return null;
  return new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(deadline);
}
