const DEFAULT_URL = 'https://manguare-services-c9hpebgcduf0gfdr.eastus2-01.azurewebsites.net';
const rawBase = process.argv[2] ?? process.env.MANGUARE_PUBLIC_URL ?? DEFAULT_URL;
const base = new URL(rawBase);
if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' ||
    base.search || base.hash) {
  throw new Error('Usa la URL HTTPS base del App Service, sin rutas ni credenciales.');
}

async function request(route, expectedStatus) {
  const response = await fetch(new URL(route, base), {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  process.stdout.write(`${route}: HTTP ${response.status}\n`);
  if (response.status !== expectedStatus) {
    throw new Error(`${route}: se esperaba HTTP ${expectedStatus}; la API no está publicada o está mal configurada.`);
  }
  return response;
}

const health = await (await request('/api/health', 200)).json();
if (health?.ok !== true) throw new Error('/api/health no confirmó el estado de la API.');
const session = await (await request('/api/panel/session', 200)).json();
if (session?.authRequired !== true) throw new Error('El panel no está protegido con contraseña.');
const alerts = await (await request('/api/alerts', 401)).json();
if (alerts?.error !== 'authentication_required') {
  throw new Error('/api/alerts no exigió la sesión del panel.');
}
for (const route of ['/', '/panel']) {
  const response = await request(route, 200);
  const body = await response.text();
  if (!body.toLowerCase().includes('<!doctype html')) {
    throw new Error(`${route}: no devolvió la página HTML de Manguaré.`);
  }
}
process.stdout.write('Rutas públicas y protección del panel: correctas.\n');
