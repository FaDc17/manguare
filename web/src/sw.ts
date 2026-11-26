/// <reference lib="webworker" />
import { syncAll } from './lib/queue-worker';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string | null }>;
};

const CACHE_PREFIX = 'manguare-';
const SHELL_CACHE = 'manguare-shell-v1';
const PRECACHE_URLS = self.__WB_MANIFEST.map((entry) => entry.url);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;
  return fetch(request);
}

async function navigationRequest(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch {
    const url = new URL(request.url);
    const shell = url.pathname.startsWith('/panel') ? '/panel.html' : '/';
    const cached =
      (await caches.match(shell)) ??
      (await caches.match('/index.html')) ??
      (await caches.match('/'));
    if (cached) return cached;
    return new Response(
      '<!doctype html><html lang="es"><meta charset="utf-8"><title>Sin conexión</title><body style="font-family:system-ui;padding:2rem;background:#f5f0e4;color:#1b2a23"><h1>Sin conexión</h1><p>Abre Manguaré una vez con conexión para guardar la app en este teléfono.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationRequest(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

interface BackgroundSyncEvent extends ExtendableEvent {
  tag: string;
}

const syncTarget = self as unknown as {
  addEventListener: (
    type: 'sync',
    listener: (event: BackgroundSyncEvent) => void,
  ) => void;
};

syncTarget.addEventListener('sync', (event) => {
  if (event.tag !== 'manguare-alerts') return;
  event.waitUntil(
    (async () => {
      const result = await syncAll(true);
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((client) => client.postMessage({ type: 'manguare:sync-done', result }));
      if (result.failed > 0) {
        throw new Error('Quedan alertas pendientes de envío');
      }
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
    } else {
      await self.clients.openWindow('/');
    }
  })());
});
