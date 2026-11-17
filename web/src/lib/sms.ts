import { shortId } from './format';
import { typeLabel } from './format';
import type { AlertRecord } from './types';

/**
 * Mensaje corto en ASCII para que quepa en un SMS y se lea en teléfonos básicos.
 * No se afirma que el SMS haya sido entregado: es un canal de respaldo.
 */
export function buildSmsBody(alert: AlertRecord): string {
  const parts = [`DEVUT EMERGENCIA`, typeLabel(alert.type)];
  parts.push(alert.community.trim() || 'comunidad no indicada');
  if (alert.location) {
    parts.push(`geo:${alert.location.lat.toFixed(5)},${alert.location.lng.toFixed(5)}`);
  } else {
    parts.push('sin GPS');
  }
  parts.push(`Ref ${shortId(alert.id)}`);
  return parts.join(' | ');
}

export function smsHref(number: string, body: string): string {
  const clean = number.replace(/[^\d+*#]/g, '');
  return `sms:${clean}?&body=${encodeURIComponent(body)}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
