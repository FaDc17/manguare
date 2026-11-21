import type { Translate } from '../i18n/catalog';
import type { AlertState, EmergencyType } from './types';

// Localiza tiempos como «ayer» y conserva el valor numérico del intervalo.
export function formatRelative(iso: string, t: Translate, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  if (!Number.isFinite(abs)) return '—';
  if (abs < 45_000) return t('time.justNow');
  const unit = abs < 3_600_000 ? 'minute' : abs < 86_400_000 ? 'hour' : 'day';
  const milliseconds = { minute: 60_000, hour: 3_600_000, day: 86_400_000 }[unit];
  const relative = Math.round(diff / milliseconds);
  if (unit === 'day' && relative === -1) return t('time.yesterday');
  if (unit === 'day' && relative === 1) return t('time.tomorrow');
  const count = Math.abs(relative);
  const direction = relative < 0 ? 'past' : 'future';
  if (unit === 'day') return t(`time.day.${direction}.other`, { count });
  return t(`time.${unit}.${direction}.${count === 1 ? 'one' : 'other'}`, { count });
}

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
const twoDigits = (number: number) => String(number).padStart(2, '0');

// Compone la fecha y la hora con las plantillas del idioma elegido.
export function formatDateTime(iso: string, t: Translate): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '—';
  return t('time.dateTime', {
    day: twoDigits(date.getDate()),
    month: t(`time.month.${months[date.getMonth()]}`),
    time: formatTime(iso, t),
  });
}

export function formatTime(iso: string, t: Translate): string {
  const date = new Date(iso);
  const hours = date.getHours();
  if (!Number.isFinite(hours)) return '—';
  return t('time.clock', {
    hour: twoDigits(hours % 12 || 12),
    minute: twoDigits(date.getMinutes()),
    period: t(hours < 12 ? 'time.am' : 'time.pm'),
  });
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
