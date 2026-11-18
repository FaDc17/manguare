/**
 * Política de reintentos de la cola offline.
 *
 * Sin conexión no tiene sentido intentar cada 20 segundos: gasta batería y
 * datos. Los primeros intentos son rápidos (por si la señal vuelve enseguida)
 * y luego se espacian hasta un máximo de 5 minutos. Al recuperar conexión se
 * reinicia el calendario para intentar de inmediato.
 */
const RETRY_DELAYS_MS = [0, 15_000, 45_000, 120_000, 300_000] as const;

export const MAX_RETRY_DELAY_MS = RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];

/** Espera antes del siguiente intento, según cuántos fallos acumulados hay. */
export function retryDelayMs(attempts: number): number {
  if (!Number.isFinite(attempts) || attempts <= 0) return 0;
  const index = Math.min(Math.floor(attempts), RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[index];
}

/**
 * Calcula la marca de tiempo del próximo intento con una variación pequeña
 * para que muchos teléfonos no reintenten todos al mismo segundo.
 */
export function nextAttemptAt(
  attempts: number,
  now: number = Date.now(),
  random: () => number = Math.random,
): string | undefined {
  const delay = retryDelayMs(attempts);
  if (delay === 0) return undefined;
  const jitter = Math.round(delay * 0.15 * (random() * 2 - 1));
  return new Date(now + Math.max(0, delay + jitter)).toISOString();
}

/** ¿Ya toca intentar el envío de esta alerta? */
export function isAttemptDue(
  alert: { nextAttemptAt?: string },
  now: number = Date.now(),
): boolean {
  if (!alert.nextAttemptAt) return true;
  const due = Date.parse(alert.nextAttemptAt);
  return Number.isNaN(due) || due <= now;
}
