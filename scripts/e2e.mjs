/**
 * Prueba de punta a punta del recorrido de la demo, pensada para la fase 3:
 * - carga con CPU limitada (simula un Android de gama baja)
 * - alerta creada sin red y persistida en IndexedDB
 * - sincronización al volver la conexión
 * - panel protegido, confirmación y vuelta del estado al teléfono
 * - cambio de idioma sin red y limpieza de los ajustes del APK
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
import { BiodiversityStore } from '../server/src/biodiversity-store.js';
import { AlertStore } from '../server/src/store.js';
import { SocialStore } from '../server/src/social-store.js';

process.env.MANGUARE_LOG = '0';

const PASSWORD = 'clave-e2e';
const visualBeta = process.argv.includes('--beta-visual');
const root = path.resolve(import.meta.dirname, '..');
const staticDir = path.join(root, 'web', 'dist');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  ...(process.env.PROGRAMFILES
    ? [path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe')]
    : []),
  ...(process.env['PROGRAMFILES(X86)']
    ? [
        path.join(
          process.env['PROGRAMFILES(X86)'],
          'Microsoft',
          'Edge',
          'Application',
          'msedge.exe',
        ),
      ]
    : []),
  ...(process.env.LOCALAPPDATA
    ? [path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')]
    : []),
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

// Recorre el selector y las pantallas traducidas con una ventana móvil sin red.
async function checkLanguages(app) {
  await app.bringToFront();
  await app.setViewport({ width: 320, height: 720, isMobile: true, hasTouch: true });
  const languageSelect = '[data-testid="language-select"]';
  await app.waitForSelector(languageSelect);
  await app.select(languageSelect, 'agr');
  await app.waitForFunction(() => document.querySelector('.login-erase')?.textContent?.includes('Esakáut'));
  await app.select(languageSelect, 'es');
  await app.click('[data-testid="demo-user"]');
  await app.click('[data-testid="login-submit"]');
  await app.waitForSelector('[data-testid="sos-button"]');
  await app.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await app.setOfflineMode(true);
  await app.waitForFunction(() => !navigator.onLine);

  const openSettings = async () => {
    await app.click('[data-testid="nav-settings"]');
    await app.waitForSelector('[data-testid="settings-language"]');
  };
  const selectLanguage = async (locale, previous) => {
    await app.click('[data-testid="settings-language"]');
    await app.waitForSelector('[data-testid="language-' + previous + '"][aria-pressed="true"]');
    await app.click('[data-testid="language-' + locale + '"]');
    await app.waitForSelector('[data-testid="language-' + locale + '"]', { hidden: true });
    assert.equal(await app.$eval('[data-testid="nav-settings"]', (item) =>
      item.getAttribute('aria-current')), 'page');
  };

  await openSettings();
  await selectLanguage('agr', 'es');
  assert.equal(await app.$eval('[data-testid="nav-history"] [lang="agr"]', (label) => label.textContent), 'Mina étsejmau aidau');
  await app.click('[data-testid="nav-history"]');
  await app.waitForSelector('.screen.history h1 [lang="agr"]');
  assert.equal(await app.$eval('.screen.history h1', (heading) => heading.textContent), 'Mina étsejmau aidau');
  assert.equal(await app.$eval('[data-testid="nav-home"] [lang="agr"]', (label) => label.textContent), 'Nágkabau');
  await app.waitForSelector('[data-testid="nav-map"] [lang="agr"]');
  assert.equal(await app.$eval('[data-testid="nav-map"] span[lang]', (label) => label.textContent),
    'Núgka dakumkámu');
  assert.ok(await app.$eval('[data-testid="nav-map"]', (button) => button.scrollWidth <= button.clientWidth),
    'la etiqueta de mapa debe caber en una pantalla de 320 px');
  await app.click('[data-testid="nav-home"]');
  const awajunSos = await app.waitForSelector('[data-testid="sos-button"] [lang="agr"]');
  assert.equal(await awajunSos.evaluate((label) => label.textContent), 'Wájimas utújchat');
  assert.ok(await awajunSos.evaluate((label) =>
    label.scrollWidth <= label.clientWidth && label.clientWidth < label.closest('button').clientWidth),
    'el título del SOS en awajún debe caber dentro del botón');
  await openSettings();
  await selectLanguage('es', 'agr');

  await selectLanguage('cbt', 'es');
  assert.equal(await app.$eval('.setting-label [lang="cbt"]', (label) => label.textContent), "Ninanu'");
  assert.equal(await app.$eval('[data-testid="nav-community"] [lang="cbt"]', (label) => label.textContent), "Ninanu'");
  await app.click('[data-testid="nav-community"]');
  assert.equal(await app.$eval('[data-testid="app-screen"]', (element) => element.dataset.screen),
    'settings');
  await openSettings();
  await selectLanguage('es', 'cbt');

  await app.click('[data-testid="nav-home"]');
  await app.click('.lang-btn');
  await app.waitForSelector('[data-testid="language-es"][aria-pressed="true"]');
  const languageIntro = await app.$eval('[role="dialog"] .sheet-intro', (intro) => intro.textContent);
  assert.equal(languageIntro.includes('La beta mezcla español, términos del idioma elegido y rótulos simulados.'), visualBeta);
  await app.click('[data-testid="language-cni"]');
  const greeting = await app.waitForSelector('[data-testid="home-hello"] [lang="cni"]');
  assert.equal(await greeting.evaluate((label) => label.textContent), 'Kametsa pimpoke, Juan');
  const ashaninkaSos = await app.waitForSelector('[data-testid="sos-button"] [lang="cni"]');
  assert.equal(await ashaninkaSos.evaluate((label) => label.textContent), 'Shintsipaite yabintete');
  const sosMetrics = await ashaninkaSos.evaluate((label) => {
  const button = label.closest('button');
  const style = getComputedStyle(label);
  return {
    text: label.textContent,
    scrollWidth: label.scrollWidth,
    clientWidth: label.clientWidth,
    buttonWidth: button.clientWidth,
    fontSize: style.fontSize,
    letterSpacing: style.letterSpacing,
    whiteSpace: style.whiteSpace,
    display: style.display,
    viewport: { width: innerWidth, height: innerHeight },
  };
});
console.log('ASHANINKA SOS:', JSON.stringify(sosMetrics));
assert.ok(
  sosMetrics.scrollWidth <= sosMetrics.clientWidth &&
  sosMetrics.clientWidth < sosMetrics.buttonWidth,
  'el título del SOS en asháninka debe caber dentro del botón',
);
  assert.equal(await app.$eval('.quick-title [lang="cni"]', (label) => label.textContent), 'Amitakotantsi');
  assert.equal(await app.$eval('[data-testid="nav-community"] [lang="cni"]', (label) => label.textContent), 'Nampitsi');
  await app.click('[data-testid="sos-button"]');
  const sosDialog = '[role="dialog"][aria-label="¿Desea enviar una alerta de emergencia?"]';
  await app.waitForSelector(sosDialog);
  await app.click('[data-testid="sos-confirm-cancel"]');
  await app.waitForSelector(sosDialog, { hidden: true });

  await app.click('[data-testid="nav-community"]');
  assert.equal(await app.$eval('[data-testid="app-screen"]', (element) => element.dataset.screen),
    'home');

  await app.reload({ waitUntil: 'domcontentloaded' });
  await app.waitForSelector('[data-testid="sos-button"]');
  assert.match(await app.$eval('[data-testid="home-hello"]', (label) => label.textContent), /Kametsa pimpoke, Juan/);
  await openSettings();
  await selectLanguage('es', 'cni');
  assert.equal(await app.$eval('[data-testid="nav-map"] span[lang]', (label) => label.textContent), 'Mapa');
  await app.click('[data-testid="nav-home"]');
  assert.match(await app.$eval('[data-testid="home-hello"]', (label) => label.textContent), /Hola, Juan/);
  await app.setOfflineMode(false);
}

async function main() {
  await fs.access(path.join(staticDir, 'index.html')).catch(() => {
    throw new Error('Falta web/dist. Ejecuta "npm run build" antes de la prueba E2E.');
  });

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'manguare-e2e-'));
  const store = new AlertStore(path.join(directory, 'alerts.json'));
  const biodiversityStore = new BiodiversityStore(path.join(directory, 'biodiversity.json'));
  const socialStore = new SocialStore(path.join(directory, 'social.json'));
  const dniSample = path.join(directory, 'dni-demo.png');
  await fs.writeFile(
    dniSample,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  );
  const auth = createAuth({
    enabled: true,
    password: PASSWORD,
    user: 'salud',
    secret: Buffer.from('secreto-e2e'),
  });
  const server = http.createServer(createHandler({
    store, biodiversityStore, socialStore, staticDir, auth, escalationPhone: '+51999999999',
  }));
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
    await app.waitForSelector('[data-testid="splash"]', { timeout: 15000 });
    await app.click('[data-testid="splash"]');
    await app.waitForSelector('[data-testid="splash"]', { hidden: true, timeout: 5000 });
    await app.waitForSelector('[data-testid="login-phone"]', { timeout: 15000 });
    await app.click('[data-testid="demo-user"]');
    await app.click('[data-testid="login-submit"]');
    await app.waitForSelector('[data-testid="sos-button"]', { timeout: 15000 });
    await app.browserContext().overridePermissions(base, ['notifications']);
    await app.click('[data-testid="nav-settings"]');
    await app.click('[data-testid="settings-notifications"]');
    await app.waitForFunction(() => document.querySelector('[data-testid="settings-notifications"]')
      ?.textContent?.includes('Activados'));
    await app.waitForSelector('.toast', { hidden: true, timeout: 6000 });
    await app.click('[data-testid="nav-home"]');
    results.loginMs = Date.now() - started;
    results.greeting = await app.$eval('[data-testid="home-hello"]', (element) =>
      element.textContent?.replace(/\s+/g, ' ').trim(),
    );
    assert.match(results.greeting ?? '', /Hola, Juan/);
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
    await app.click('[data-testid="nav-history"]');
    await app.click('.history > button.btn-danger');
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
    await app.waitForFunction(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return (await registration?.getNotifications())?.some((item) => item.title === 'Emergencia enviada');
    }, { timeout: 10000 });
    results.sentNotification = true;

    // 4. Panel protegido: login, confirmación y auditoría.
    const panel = await browser.newPage();
    await panel.setViewport({ width: 1280, height: 900 });
    await panel.goto(`${base}/panel`, { waitUntil: 'domcontentloaded' });
    await panel.waitForSelector('[data-testid="login-password"]', { timeout: 10000 });
    await panel.type('[data-testid="login-password"]', PASSWORD);
    await panel.select('[data-testid="language-select"]', 'cni');
    assert.ok(await panel.$eval('[data-testid="login-password"]', (input) => input.value.length > 0));
    await panel.select('[data-testid="language-select"]', 'es');
    await panel.click('[data-testid="login-submit"]');
    await panel.bringToFront();
    await panel.waitForSelector('[data-testid^="ack-"]', { timeout: 15000 });
    await panel.waitForFunction(() => document.body.textContent?.includes('Reportó Juan'), {
      timeout: 5000,
    });
    await panel.select('[data-testid="language-select"]', 'cbt');
    assert.ok(await panel.$('[data-testid^="ack-"]'), 'el panel conserva la sesión al cambiar el idioma');
    await panel.select('[data-testid="language-select"]', 'es');
    results.panelReporter = true;
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

    // La red deja una indicación para la comunidad.
    await panel.click('.panel-detail');
    await panel.waitForSelector('[data-testid="respond-en_camino"]', { timeout: 5000 });
    await panel.click('[data-testid="respond-en_camino"]');
    await panel.waitForFunction(
      () => document.body.textContent?.includes('Ambulancia o brigada en camino'),
      { timeout: 10000 },
    );
    await panel.click('.panel-modal .panel-detail--large');
    await panel.waitForSelector('.panel-modal', { hidden: true, timeout: 5000 });
    results.panelResponse = true;

    // Dos alertas con el mismo GPS deben aparecer juntas y abrirse por separado.
    const mapLocation = { lat: -12.0464, lng: -77.0428, accuracy: 10,
      capturedAt: new Date().toISOString() };
    const mapAlert = {
      type: 'mordedura', isSos: false, note: 'Mordedura de serpiente en el brazo',
      community: 'Awajun', deviceName: 'Teléfono de prueba', consentLocation: true,
      location: mapLocation, clientCreatedAt: new Date().toISOString(),
      serverReceivedAt: new Date().toISOString(),
    };
    await store.add({ ...mapAlert, id: 'map-alert-1' });
    await store.add({ ...mapAlert, id: 'map-alert-2', type: 'accidente',
      note: 'Caída con dolor fuerte', ackDeadlineAt: new Date(Date.now() - 60_000).toISOString() });
    await panel.reload({ waitUntil: 'domcontentloaded' });
    await panel.waitForSelector('.panel-view-switch [role="tab"]', { timeout: 10000 });
    await panel.click('.panel-view-switch [role="tab"]:last-child');
    await panel.waitForSelector('.panel-map-count', { timeout: 10000 });
    assert.equal(await panel.$eval('.panel-map-count', (element) => element.textContent), '2');
    await panel.click('.panel-emergency-map .leaflet-interactive');
    await panel.waitForSelector('.panel-map-group-popup li', { timeout: 5000 });
    assert.equal(await panel.$$eval('.panel-map-group-popup li', (items) => items.length), 2);
    await panel.click('.panel-map-group-popup li:last-child button');
    await panel.waitForSelector('.panel-modal', { timeout: 5000 });
    assert.ok(await panel.$eval('.panel-modal', (element) =>
      element.textContent?.includes('Caída con dolor fuerte')));
    const escalationSms = await panel.$eval('.panel-escalate a', (element) =>
      element.getAttribute('href'));
    assert.ok(decodeURIComponent(escalationSms).includes('Detalle: Caída con dolor fuerte'));
    await panel.click('.panel-modal .panel-icon-btn');
    await panel.click('.panel-view-switch [role="tab"]:first-child');
    results.groupedMapAlertsAndEscalationSms = true;

    // 5. El teléfono recibe la confirmación y la respuesta.
    await app.bringToFront();
    await app.waitForFunction(
      () => {
        const button = document.querySelector('[data-testid="refresh-status"]');
        return button instanceof HTMLButtonElement && !button.disabled;
      },
      { timeout: 15000 },
    );
    await app.click('[data-testid="refresh-status"]');
    await app.waitForFunction(
      () => document.querySelector('[data-testid="alert-state"]')?.textContent === 'Recibida',
      { timeout: 45000 },
    );
    await app.waitForFunction(
      () => document.body.textContent?.includes('Ambulancia o brigada en camino'),
      { timeout: 10000 },
    );
    results.appResponse = true;
    results.receivedState = 'Recibida';
    await app.waitForFunction(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return (await registration?.getNotifications())?.some((item) => item.title === 'Respuesta de la red de salud');
    }, { timeout: 10000 });
    results.responseNotification = true;

    // 6. Sin pendientes, no debe consultar cada 20 s (batería/datos).
    // Deja terminar cualquier sincronización en curso antes de medir.
    await new Promise((resolve) => setTimeout(resolve, 6000));
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

    // 7. El SOS exige detalle antes de enviarse y se puede editar después.
    await app.click('[data-testid="nav-home"]');
    const alertCountBeforeSos = (await store.list()).length;
    await app.click('[data-testid="sos-button"]');
    await app.click('[data-testid="sos-confirm-cancel"]');
    await app.waitForFunction(
      () => !document.querySelector('[data-testid="sos-confirm-send"]'),
      { timeout: 5000 },
    );
    assert.equal((await store.list()).length, alertCountBeforeSos, 'No debe enviar al elegir No');

    await app.click('[data-testid="sos-button"]');
    await app.click('[data-testid="sos-confirm-send"]');
    await app.waitForSelector('[data-testid="alert-note"]', { timeout: 15000 });
    assert.equal((await store.list()).length, alertCountBeforeSos, 'Confirmar no debe enviar una alerta vacía');
    await app.click('[data-testid="submit-alert"]');
    assert.equal((await store.list()).length, alertCountBeforeSos, 'Sin descripción no se debe enviar el SOS');
    await app.type('[data-testid="alert-note"]', 'Necesitamos apoyo en la ribera.');
    await app.click('[data-testid="alert-community"]', { clickCount: 3 });
    await app.type('[data-testid="alert-community"]', 'Río de la comunidad');
    await app.click('[data-testid="submit-alert"]');
    await app.waitForSelector('[data-testid="sos-detail-open"]', { timeout: 15000 });
    await app.waitForFunction(
      () => document.querySelector('[data-testid="alert-state"]')?.textContent === 'Enviada',
      { timeout: 15000 },
    );
    await app.click('[data-testid="sos-detail-open"]');
    await app.$eval('[data-testid="sos-detail-description"]', (textarea) => textarea.select());
    await app.keyboard.press('Backspace');
    await app.type('[data-testid="sos-detail-description"]', 'Necesitamos apoyo adicional en la ribera.');
    await app.click('[data-testid="sos-detail-save"]');
    await app.waitForFunction(
      () => !document.querySelector('[data-testid="sos-detail-save"]'),
      { timeout: 10000 },
    );
    const sosAlerts = (await store.list()).filter((alert) => alert.isSos);
    assert.equal(sosAlerts.length, 1, 'El detalle debe actualizar la misma alerta SOS');
    assert.equal(sosAlerts[0].note, 'Necesitamos apoyo adicional en la ribera.');
    assert.equal(sosAlerts[0].community, 'Río de la comunidad');
    results.sosDetailUpdatedExistingAlert = true;

    await panel.bringToFront();
    const sosAckSelector = `[data-testid="ack-${sosAlerts[0].id}"]`;
    await panel.waitForSelector(sosAckSelector, { timeout: 10000 });
    await panel.click(sosAckSelector);
    await panel.waitForFunction(
      (selector) => !document.querySelector(selector),
      { timeout: 10000 },
      sosAckSelector,
    );
    await app.bringToFront();
    await app.waitForFunction(() => {
      const button = document.querySelector('[data-testid="refresh-status"]');
      return button instanceof HTMLButtonElement && !button.disabled;
    }, { timeout: 15000 });
    await app.click('[data-testid="refresh-status"]');
    await app.waitForFunction(
      () => document.querySelector('[data-testid="alert-state"]')?.textContent === 'Recibida',
      { timeout: 15000 },
    );
    await app.click('[data-testid="nav-history"]');
    await app.waitForFunction(() => document.body.textContent?.includes('Recibida'), {
      timeout: 10000,
    });
    results.sosReceivedStateInProfile = true;

    // 8. Las secciones pausadas no deben abrirse desde la navegaci?n.
    const currentScreen = await app.$eval('[data-testid="app-screen"]', (element) =>
      element.dataset.screen);
    for (const tab of ['nav-community', 'nav-network']) {
      await app.click(`[data-testid="${tab}"]`);
      assert.equal(
        await app.$eval('[data-testid="app-screen"]', (element) => element.dataset.screen),
        currentScreen,
      );
    }
    results.disabledSectionsStayClosed = true;

    // 9. Mapa: solo Conecta y centros de apoyo; ubica y enfoca resultados.
    await app.click('[data-testid="nav-map"]');
    await app.waitForSelector('[data-testid="map-filter-conecta"]', { timeout: 15000 });
    const mapFilters = await app.$$eval('.map-filters button', (buttons) =>
      buttons.map((button) => button.textContent?.trim()),
    );
    assert.deepEqual(mapFilters, ['Conecta', 'Centro de apoyo']);
    await app.browserContext().overridePermissions(base, ['geolocation']);
    await app.setGeolocation({ latitude: -5.9, longitude: -76.1 });
    await app.click('.map-location-button');
    await app.waitForFunction(() => document.body.textContent?.includes('Actualizar mi ubicación'));
    await app.type('[data-testid="map-search-input"]', 'Hospital');
    await app.waitForFunction(
      () => document.querySelector('.map-result-list')?.textContent?.includes('Hospital'),
    );
    await app.click('.map-result-list button');
    await app.waitForSelector('[data-testid="map-selected"]');
    assert.ok(
      (await app.$eval('[data-testid="map-selected"]', (element) => element.textContent)).includes(
        'Hospital',
      ),
    );
    results.mapLocationAndFilters = true;

    // 10. Cerrar sesión y completar registro local con DNI de demostración.
    await app.click('[data-testid="nav-settings"]');
    await app.click('[data-testid="logout-button"]');
    await app.waitForSelector('[data-testid="login-phone"]', { timeout: 5000 });
    await app.click('[data-testid="register-link"]');
    await app.waitForSelector('[data-testid="register-submit"]');

    await app.type('[data-testid="register-phone"]', '123');
    await app.type('[data-testid="register-email"]', 'correo-invalido');
    await app.click('[data-testid="register-submit"]');
    await app.waitForFunction(
      () =>
        document.body.textContent?.includes('Usa 9 dígitos y empieza con 9') &&
        document.body.textContent?.includes('Escribe un correo válido.'),
    );
    await app.select('[data-testid="language-select"]', 'cni');
    await app.waitForFunction(() => document.body.textContent?.includes('Pisankenatero pibajiro.'));
    assert.equal(await app.$eval('[data-testid="register-email"]', (input) => input.value), 'correo-invalido');
    await app.select('[data-testid="language-select"]', 'es');

    await app.click('[data-testid="register-first-name"]');
    await app.type('[data-testid="register-first-name"]', 'Ana');
    await app.type('[data-testid="register-last-name"]', 'Demo');
    await app.click('[data-testid="register-phone"]');
    await app.keyboard.down('Control');
    await app.keyboard.press('A');
    await app.keyboard.up('Control');
    await app.keyboard.press('Backspace');
    await app.type('[data-testid="register-phone"]', '923456789');
    await app.click('[data-testid="register-email"]');
    await app.keyboard.down('Control');
    await app.keyboard.press('A');
    await app.keyboard.up('Control');
    await app.keyboard.press('Backspace');
    await app.type('[data-testid="register-email"]', 'ana.demo@example.com');
    await app.select('[data-testid="register-department"]', 'Amazonas');
    await app.select('[data-testid="register-province"]', 'Bagua');
    await app.select('[data-testid="register-district"]', 'Bagua');
    await app.type('[data-testid="register-community"]', 'aguajun');
    await app.type('[data-testid="register-address"]', 'Cerca del río');
    await app.type('[data-testid="register-pin"]', '654321');
    await app.type('[data-testid="register-pin-confirm"]', '654321');
    await app.click('[data-testid="register-leader-yes"]');
    await (await app.$('[data-testid="register-dni-front"]')).uploadFile(dniSample);
    await (await app.$('[data-testid="register-dni-back"]')).uploadFile(dniSample);
    await app.waitForSelector('img[alt="Vista previa Frontal del DNI"]');
    await app.waitForSelector('img[alt="Vista previa Posterior del DNI"]');
    await app.click('[data-testid="register-submit"]');
    await app.waitForSelector('[data-testid="register-accept"]', { timeout: 5000 });
    await app.click('[data-testid="register-accept"]');
    await app.waitForFunction(() =>
      document.body.textContent?.includes('Tu solicitud de líder quedó registrada localmente'),
    );
    await app.click('[data-testid="register-continue"]');
    await app.waitForFunction(() => document.body.textContent?.includes('Hola, Ana'));
    await app.click('[data-testid="nav-settings"]');
    await app.click('[data-testid="logout-button"]');
    await app.waitForSelector('[data-testid="login-phone"]');
    await app.type('[data-testid="login-phone"]', '923456789');
    for (const digit of '654321') await app.click(`[data-testid="login-key-${digit}"]`);
    await app.click('[data-testid="login-submit"]');
    await app.waitForFunction(() => document.body.textContent?.includes('Hola, Ana'));
    results.registrationValidationAndLocalLogin = true;

    // 11. Cerrar sesión de la app vuelve al acceso.
    await app.click('[data-testid="nav-settings"]');
    await app.click('[data-testid="logout-button"]');
    await app.waitForSelector('[data-testid="login-phone"]', { timeout: 5000 });
    results.appLogoutWorks = true;

    // 12. Cerrar sesión deja el panel bloqueado.
    await panel.bringToFront();
    await panel.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((item) =>
        item.textContent?.includes('Salir'),
      );
      button?.click();
    });
    await panel.waitForSelector('[data-testid="login-password"]', { timeout: 10000 });
    results.logoutWorks = true;

    await checkLanguages(app);
    results.languagesOfflineAndPersisted = true;

    // El asistente y los ajustes del APK no ofrecen controles del servidor.
    const simulatedAndroid = await app.evaluate(() => {
      window.androidBridge = {};
      return window.Capacitor?.isNativePlatform();
    });
    assert.equal(simulatedAndroid, true);
    const screenBeforeNetwork = await app.$eval('[data-testid="app-screen"]',
      (element) => element.dataset.screen);
    await app.click('[data-testid="nav-network"]');
    assert.equal(
      await app.$eval('[data-testid="app-screen"]', (element) => element.dataset.screen),
      screenBeforeNetwork,
    );
    await app.click('[data-testid="nav-settings"]');
    await app.waitForSelector('[data-testid="settings-language"]');
    const settingsText = await app.evaluate(() => document.body.innerText);
    assert.doesNotMatch(
      settingsText,
      /Servidor Manguare|Contacto y respaldo|Comprobar con Gemini|Simular conexión|Guía de audio/,
    );
    assert.equal(await app.$('[data-testid="settings-native-server-url"]'), null);
    assert.equal(await app.$('[data-testid="settings-server-check"]'), null);
    results.settingsServerAndUnusedFeaturesHidden = true;

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
