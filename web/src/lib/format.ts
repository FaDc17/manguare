import type { AlertState, EmergencyType } from './types';

const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
const dateTime = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  if (abs < 45_000) return 'hace un momento';
  if (abs < 3_600_000) return relative.format(Math.round(diff / 60_000), 'minute');
  if (abs < 86_400_000) return relative.format(Math.round(diff / 3_600_000), 'hour');
  return relative.format(Math.round(diff / 86_400_000), 'day');
}

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export const STATE_LABEL: Record<AlertState, string> = {
  pending: 'Pendiente',
  sent: 'Enviada',
  received: 'Recibida',
  canceled: 'Anulada',
};

export const STATE_DESCRIPTION: Record<AlertState, string> = {
  pending: 'Guardada en tu teléfono. Aún no llega a la red de salud.',
  sent: 'Llegó al servidor de Manguaré. La red de salud todavía no confirma.',
  received: 'La red de salud confirmó que recibió la alerta.',
  canceled: 'La alerta fue anulada en este teléfono.',
};

export function typeLabel(type: EmergencyType): string {
  const labels: Record<EmergencyType, string> = {
    enfermedad: 'Enfermedad',
    accidente: 'Accidente',
    mordedura: 'Mordedura',
    parto: 'Parto',
    otro: 'Otro',
  };
  return labels[type];
}
