import { syncAll } from './queue-core';
import { loadSettings } from './settings';

export const QUEUE_CHANGED_EVENT = 'manguare:queue-changed';

export function isEffectivelyOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine && !loadSettings().simulateOffline;
}

export function notifyQueueChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(QUEUE_CHANGED_EVENT));
  }
}

export async function requestBackgroundSync(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;
    const sync = (registration as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    }).sync;
    if (sync) {
      await sync.register('manguare-alerts');
    }
  } catch {
    // Background Sync no está disponible: la app sincroniza en primer plano.
  }
}

export async function runSync(): Promise<{ sent: number; failed: number; updated: number } | null> {
  if (!isEffectivelyOnline()) return null;
  try {
    const result = await syncAll();
    notifyQueueChanged();
    return result;
  } catch {
    notifyQueueChanged();
    return null;
  } finally {
    void requestBackgroundSync();
  }
}

export function getConnectionLabel(online: boolean): string {
  return online ? 'Con conexión' : 'Sin conexión';
}
