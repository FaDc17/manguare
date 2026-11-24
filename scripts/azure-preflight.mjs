import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { azureSqlConfig } from '../server/src/azure-sql.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function validateAzureEnvironment(env = process.env) {
  if (env.NODE_ENV !== 'production') throw new Error('NODE_ENV debe ser production.');
  if (env.MANGUARE_STORAGE !== 'azure-sql') {
    throw new Error('MANGUARE_STORAGE debe ser azure-sql en App Service.');
  }
  const config = azureSqlConfig(env);
  if (config.server !== 'sql-kuska-fadc.database.windows.net') {
    throw new Error('AZURE_SQL_SERVER no coincide con el servidor confirmado.');
  }
  if (!env.MANGUARE_PANEL_PASSWORD || env.MANGUARE_PANEL_PASSWORD === 'cambia-esta-clave' ||
      env.MANGUARE_PANEL_PASSWORD.startsWith('REEMPLAZAR_')) {
    throw new Error('Configura la contraseña actual del panel en MANGUARE_PANEL_PASSWORD.');
  }
  if (!env.MANGUARE_SESSION_SECRET || env.MANGUARE_SESSION_SECRET.length < 32 ||
      env.MANGUARE_SESSION_SECRET === 'cambia-este-secreto-largo-y-aleatorio' ||
      env.MANGUARE_SESSION_SECRET.startsWith('REEMPLAZAR_')) {
    throw new Error('MANGUARE_SESSION_SECRET debe tener al menos 32 caracteres aleatorios.');
  }
  if (env.MANGUARE_SECURE_COOKIES !== '1') {
    throw new Error('MANGUARE_SECURE_COOKIES debe ser 1.');
  }
  return env.MANGUARE_STATIC_DIR ?? path.join(root, 'web', 'dist');
}

export async function checkAzureBuild(env = process.env) {
  const staticDir = validateAzureEnvironment(env);
  for (const name of ['index.html', 'panel.html', 'sw.js']) {
    try {
      await fs.access(path.join(staticDir, name));
    } catch {
      throw new Error(`Falta ${name} en ${staticDir}; ejecuta npm run build.`);
    }
  }
  return staticDir;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkAzureBuild();
  process.stdout.write('Azure preflight correcto: entorno y archivos web listos.\n');
}
