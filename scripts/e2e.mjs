/**
 * Prueba de punta a punta del recorrido de la demo, pensada para la fase 3:
 * - carga con CPU limitada (simula un Android de gama baja)
 * - alerta creada sin red y persistida en IndexedDB
 * - sincronización al volver la conexión
 * - panel protegido, confirmación y vuelta del estado al teléfono
 * - sin alertas pendientes, la app no consulta el servidor cada 20 s
 *
 * Requiere Chromium/Chrome instalado y `npm run build` hecho.
 * Uso: node scripts/e2e.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';
import { createHandler } from '../server/src/app.js';
import { createAuth } from '../server/src/auth.js';
import { AlertStore } from '../server/src/store.js';

process.env.MANGUARE_LOG = '0';

const PASSWORD = 'clave-e2e';
const root = path.resolve(import.meta.dirname, '..');
const staticDir = path.join(root, 'web', 'dist');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

async function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // siguiente
    }
  }
  throw new Error('No se encontró Chromium/Chrome. Define CHROME_PATH.');
}

async function main() {
  await fs.access(path.join(staticDir, 'index.html')).catch(() => {
    throw new Error('Falta web/dist. Ejecuta "npm run build" antes de la prueba E2E.');
  });

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'manguare-e2e-'));
  const store = new AlertStore(path.join(directory, 'alerts.json'));
  const auth = createAuth({
    enabled: true,
    password: PASSWORD,
    user: 'salud',
    secret: Buffer.from('secreto-e2e'),
  });
  const server = http.createServer(createHandler({ store, staticDir, auth }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const browser = await puppeteer.launch({
    executablePath: await findChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const results = {};
  try {
    const app = await browser.newPage();
    await app.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    // 4x más lento: un equipo de gama baja típico.
    await app.emulateCPUThrottling(4);
    await app.emulateNetworkConditions({
      offline: false,
      download: 1.5 * 1024 * 1024,
      upload: 750 * 1024,
      latency: 120,
    });

    const started = Date.now();
    await app.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
    await app.waitForSelector('[data-testid="sos-button"]', { timeout: 15000 });
    results.loadMs = Date.now() - started;

    const navigation = await app.evaluate(() => {
      const entry = performance.getEntriesByType('navigation')[0];
      return entry
        ? {
            domContentLoaded: Math.round(entry.domContentLoadedEventEnd),
            load: Math.round(entry.loadEventEnd),
          }
        : null;
    });
    results.navigation = navigation;
    assert.ok(results.loadMs < 10000, `la app tardó demasiado en cargar: ${results.loadMs} ms`);

    // 1. Crear la alerta sin red.
    await app.setOfflineMode(true);
    await app.waitForFunction(() => navigator.onLine === false, { timeout: 5000 });
    await app.click('[data-testid="sos-button"]');
    await app.click('[data-testid="type-mordedura"]');
    await app.waitForSelector('[data-testid="continue-button"]');
    await app.type('input[placeholder^="Ej. Nueva Esperanza"]', 'Comunidad E2E');
    await app.click('[data-testid="continue-button"]');
    await app.waitForSelector('[data-testid="submit-alert"]');
    await app.click('[data-testid="submit-alert"]');

    await app.waitForFunction(
      () => document.querySelector('[data-testid="alert-state"]')?.textContent === 'Pendiente',
      { timeout: 10000 },
    );
    results.offlineState = 'Pendiente';

    // 2. La cola sobrevive a recargar la app (IndexedDB, no memoria).
    const queued = await app.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open('manguare');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('alerts', 'readonly');
            const all = tx.objectStore('alerts').getAll();
            all.onsuccess = () => resolve(all.result.length);
            all.onerror = () => reject(all.error);
          };
        }),
    );
    assert.equal(queued, 1, 'la alerta debe quedar guardada en IndexedDB');
    await app.reload({ waitUntil: 'domcontentloaded' });
    await app.waitForSelector('[data-testid="sos-button"]', { timeout: 15000 });
    results.persistedAfterReload = true;

    // 3. Volver la conexión y reintentar.
    await app.setOfflineMode(false);
    await app.emulateNetworkConditions({
      offline: false,
      download: -1,
      upload: -1,
      latency: 0,
    });
    await app.waitForFunction(() => navigator.onLine === true, { timeout: 5000 });
    await app.reload({ waitUntil: 'domcontentloaded' });
    await app.waitForSelector('[data-testid="sos-button"]', { timeout: 15000 });
    await app.click('[data-testid="nav-history"]');
    const card = await app.waitForSelector('[data-testid^="alert-"]', { timeout: 10000 });
    await card.click();
    await app.waitForSelector('[data-testid="alert-state"]', { timeout: 10000 });
    await app.click('[data-testid="refresh-status"]');
    await app.waitForFunction(
      () => document.querySelector('[data-testid="alert-state"]')?.textContent === 'Enviada',
      { timeout: 30000 },
    );
    results.onlineState = 'Enviada';

    // 4. Panel protegido: login, confirmación y auditoría.
    const panel = await browser.newPage();
    await panel.setViewport({ width: 1280, height: 900 });
    await panel.goto(`${base}/panel`, { waitUntil: 'domcontentloaded' });
    await panel.waitForSelector('[data-testid="login-password"]', { timeout: 10000 });
    await panel.type('[data-testid="login-password"]', PASSWORD);
    await panel.click('[data-testid="login-submit"]');
    await panel.waitForSelector('[data-testid^="ack-"]', { timeout: 10000 });
    const ackButton = await panel.$('[data-testid^="ack-"]');
    await ackButton.click();
    await panel.waitForFunction(
      () => document.body.textContent?.includes('Recibida'),
      { timeout: 10000 },
    );
    const panelCookies = await panel.cookies();
    assert.ok(
      panelCookies.some((cookie) => cookie.name === 'manguare_session' && cookie.httpOnly),
      'la cookie de sesión debe ser HttpOnly',
    );
    results.panelConfirmed = true;

    // 5. El teléfono recibe la confirmación.
    await app.bringToFront();
    await app.click('[data-testid="refresh-status"]');
    await app.waitForFunction(
      () => document.querySelector('[data-testid="alert-state"]')?.textContent === 'Recibida',
      { timeout: 30000 },
    );
    results.receivedState = 'Recibida';

    // 6. Sin pendientes, no debe consultar cada 20 s (batería/datos).
    let apiRequests = 0;
    const countRequest = (request) => {
      if (request.url().includes('/api/')) apiRequests += 1;
    };
    app.on('request', countRequest);
    await new Promise((resolve) => setTimeout(resolve, 3500));
    app.off('request', countRequest);
    results.idleApiRequestsIn3s = apiRequests;
    assert.ok(
      apiRequests === 0,
      `con la cola vacía no debería consultar el servidor: ${apiRequests} solicitudes`,
    );

    // 7. Cerrar sesión deja el panel bloqueado.
    await panel.bringToFront();
    await panel.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((item) =>
        item.textContent?.includes('Salir'),
      );
      button?.click();
    });
    await panel.waitForSelector('[data-testid="login-password"]', { timeout: 10000 });
    results.logoutWorks = true;

    console.log('\nE2E OK');
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('\nE2E FALLÓ');
  console.error(error);
  process.exitCode = 1;
});
