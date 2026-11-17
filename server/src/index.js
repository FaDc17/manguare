import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from './app.js';
import { AlertStore } from './store.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '0.0.0.0';
const dataFile = process.env.MANGUARE_DATA_FILE ?? path.join(root, 'server', 'data', 'alerts.json');
const staticDir = process.env.MANGUARE_STATIC_DIR ?? path.join(root, 'web', 'dist');

const store = new AlertStore(dataFile);
const server = http.createServer(createHandler({ store, staticDir }));

function lanAddresses() {
  const addresses = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const info of interfaces ?? []) {
      if (info.family === 'IPv4' && !info.internal) addresses.push(info.address);
    }
  }
  return addresses;
}

server.listen(port, host, () => {
  console.log('');
  console.log('  Manguaré · servidor de alertas');
  console.log(`  App:    http://localhost:${port}`);
  console.log(`  Panel:  http://localhost:${port}/panel`);
  for (const address of lanAddresses()) {
    console.log(`  Red:    http://${address}:${port}  (misma Wi-Fi / USB)`);
  }
  console.log(`  Datos:  ${dataFile}`);
  console.log(`  Web:    ${staticDir}`);
  if (!fs.existsSync(path.join(staticDir, 'index.html'))) {
    console.log('');
    console.log('  Aviso: no se encontró la web compilada. Ejecuta "npm run build" antes de usar');
    console.log('  el servidor de producción, o usa "npm run dev" para desarrollo.');
  }
  console.log('');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`El puerto ${port} ya está en uso. Cierra el otro proceso o usa PORT=otro.`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\nCerrando Manguaré…');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
