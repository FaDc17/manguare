import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createHandler } from '../src/app.js';
import { createAuth } from '../src/auth.js';
import { BiodiversityStore } from '../src/biodiversity-store.js';
import { AlertStore } from '../src/store.js';

process.env.MANGUARE_LOG = '0';
process.env.MANGUARE_TRUST_PROXY = '0';

let server;
let base;
let directory;

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'manguare-auth-'));
  const staticDir = path.join(directory, 'static');
  await fs.mkdir(staticDir, { recursive: true });
  await fs.writeFile(path.join(staticDir, 'index.html'), '<html>INDEX</html>');
  await fs.writeFile(path.join(staticDir, 'panel.html'), '<html>PANEL</html>');

  const store = new AlertStore(path.join(directory, 'alerts.json'));
  const biodiversityStore = new BiodiversityStore(path.join(directory, 'biodiversity.json'));
  const auth = createAuth({
    enabled: true,
    password: 'clave-de-prueba',
    user: 'salud',
    secret: Buffer.from('secreto-de-prueba'),
    ttlMs: 60 * 60 * 1000,
  });
  server = http.createServer(createHandler({ store, biodiversityStore, staticDir, auth }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(directory, { recursive: true, force: true });
});

function alertPayload(id) {
  return {
    id,
    type: 'enfermedad',
    note: 'Prueba de autenticación',
    community: 'Nueva Esperanza',
    deviceName: 'Celular de prueba',
    consentLocation: false,
    clientCreatedAt: new Date().toISOString(),
  };
}

async function login(password = 'clave-de-prueba') {
  const response = await fetch(`${base}/api/panel/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'salud', password }),
  });
  return { response, data: await response.json().catch(() => ({})) };
}

test('el panel exige sesión para listar y confirmar alertas', async () => {
  const created = await fetch(`${base}/api/alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(alertPayload('auth-alert-0001')),
  });
  assert.equal(created.status, 201);

  const report = await fetch(`${base}/api/biodiversity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'auth-bio-report-01',
      category: 'Tala ilegal',
      title: 'Tala junto al río',
      description: 'Árboles cortados cerca de la comunidad.',
      reportedBy: 'Ana',
      clientCreatedAt: new Date().toISOString(),
    }),
  });
  assert.equal(report.status, 201);

  // La app móvil puede consultar su propia alerta por id, sin sesión.
  const own = await fetch(`${base}/api/alerts/auth-alert-0001`);
  assert.equal(own.status, 200);

  const reportStatus = await fetch(`${base}/api/biodiversity/auth-bio-report-01/status`);
  assert.equal(reportStatus.status, 200);
  assert.equal((await reportStatus.json()).report.state, 'sent');

  const list = await fetch(`${base}/api/alerts`);
  assert.equal(list.status, 401);
  assert.equal((await list.json()).error, 'authentication_required');

  const reportList = await fetch(`${base}/api/biodiversity`);
  assert.equal(reportList.status, 401);
  const reportDetails = await fetch(`${base}/api/biodiversity/auth-bio-report-01`);
  assert.equal(reportDetails.status, 401);
  const markReportRead = await fetch(`${base}/api/biodiversity/auth-bio-report-01/read`, {
    method: 'POST',
  });
  assert.equal(markReportRead.status, 401);

  const ack = await fetch(`${base}/api/alerts/auth-alert-0001/received`, { method: 'POST' });
  assert.equal(ack.status, 401);

  const session = await (await fetch(`${base}/api/panel/session`)).json();
  assert.equal(session.authRequired, true);
  assert.equal(session.authenticated, false);
  assert.equal(session.config.ackMinutes, 10);
  assert.equal(session.config.escalationPhone, '');
});

test('rechaza credenciales incorrectas y acepta las correctas con cookie segura', async () => {
  const wrong = await login('otra-clave');
  assert.equal(wrong.response.status, 401);
  assert.equal(wrong.data.error, 'invalid_credentials');

  const ok = await login();
  assert.equal(ok.response.status, 200);
  assert.equal(ok.data.authenticated, true);
  const cookie = ok.response.headers.get('set-cookie') ?? '';
  assert.match(cookie, /manguare_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);

  const list = await fetch(`${base}/api/alerts`, { headers: { cookie } });
  assert.equal(list.status, 200);
  const body = await list.json();
  assert.equal(body.alerts.length, 1);

  const reportList = await fetch(`${base}/api/biodiversity`, { headers: { cookie } });
  assert.equal(reportList.status, 200);
  assert.equal((await reportList.json()).reports.length, 1);
  const reportDetails = await fetch(`${base}/api/biodiversity/auth-bio-report-01`, {
    headers: { cookie },
  });
  assert.equal(reportDetails.status, 200);
  const markReportRead = await fetch(`${base}/api/biodiversity/auth-bio-report-01/read`, {
    method: 'POST',
    headers: { cookie },
  });
  assert.equal(markReportRead.status, 200);
});

test('la confirmación queda auditada con el usuario de la sesión', async () => {
  const ok = await login();
  const cookie = ok.response.headers.get('set-cookie');
  const ack = await fetch(`${base}/api/alerts/auth-alert-0001/received`, {
    method: 'POST',
    headers: { cookie },
  });
  assert.equal(ack.status, 200);
  const { alert } = await ack.json();
  assert.ok(alert.acknowledgedAt);
  assert.equal(alert.acknowledgedBy, 'salud');
  assert.equal(alert.events.at(-1).type, 'received');
  assert.equal(alert.events.at(-1).by, 'salud');

  // Sigue siendo idempotente y no agrega eventos duplicados.
  const again = await fetch(`${base}/api/alerts/auth-alert-0001/received`, {
    method: 'POST',
    headers: { cookie },
  });
  const second = (await again.json()).alert;
  assert.equal(second.acknowledgedAt, alert.acknowledgedAt);
  assert.equal(second.events.length, alert.events.length);

  const response = await fetch(`${base}/api/alerts/auth-alert-0001/responses`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'acudir_posta' }),
  });
  assert.equal(response.status, 200);
  const withResponse = (await response.json()).alert;
  assert.equal(withResponse.responses.length, 1);
  assert.equal(withResponse.responses[0].code, 'acudir_posta');
});

test('las respuestas de la red requieren sesión', async () => {
  const response = await fetch(`${base}/api/alerts/auth-alert-0001/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'en_camino' }),
  });
  assert.equal(response.status, 401);
});

test('cerrar sesión invalida la cookie', async () => {
  const ok = await login();
  const cookie = ok.response.headers.get('set-cookie');
  const logout = await fetch(`${base}/api/panel/logout`, {
    method: 'POST',
    headers: { cookie },
  });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie') ?? '', /Max-Age=0/);

  const list = await fetch(`${base}/api/alerts`, { headers: { cookie } });
  assert.equal(list.status, 401);
});

test('limita los intentos de login fallidos por IP', async () => {
  // Las pruebas anteriores ya consumieron algunos intentos; se agota el cupo.
  let blocked = null;
  for (let index = 0; index < 10; index += 1) {
    const attempt = await login('incorrecta');
    if (attempt.response.status === 429) {
      blocked = attempt;
      break;
    }
  }
  assert.ok(blocked, 'se esperaba un 429 tras varios intentos fallidos');
  assert.equal(blocked.data.error, 'too_many_attempts');
  assert.ok(Number(blocked.response.headers.get('retry-after')) > 0);
});
