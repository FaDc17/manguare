import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkAzureBuild, validateAzureEnvironment } from '../../scripts/azure-preflight.mjs';

const valid = {
  NODE_ENV: 'production',
  MANGUARE_STORAGE: 'azure-sql',
  AZURE_SQL_SERVER: 'sql-kuska-fadc.database.windows.net',
  AZURE_SQL_DATABASE: 'manguara_bd',
  MANGUARE_PANEL_PASSWORD: 'contraseña-de-prueba',
  MANGUARE_SESSION_SECRET: 'secreto-de-prueba-de-al-menos-32-caracteres',
  MANGUARE_SECURE_COOKIES: '1',
};

test('el arranque Azure rechaza base incorrecta, secretos de ejemplo y panel sin protección', () => {
  assert.throws(() => validateAzureEnvironment({ ...valid, AZURE_SQL_DATABASE: 'otra' }), /manguara_bd/);
  assert.throws(() => validateAzureEnvironment({
    ...valid, MANGUARE_PANEL_PASSWORD: 'REEMPLAZAR_CON_LA_CONTRASENA_ACTUAL_DEL_PANEL',
  }), /contraseña actual/);
  assert.throws(() => validateAzureEnvironment({ ...valid, MANGUARE_SECURE_COOKIES: '0' }), /debe ser 1/);
});

test('el arranque Azure exige las páginas compiladas antes de iniciar la API', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'manguare-azure-'));
  try {
    const env = { ...valid, MANGUARE_STATIC_DIR: dir };
    await assert.rejects(checkAzureBuild(env), /Falta index.html/);
    for (const name of ['index.html', 'panel.html', 'sw.js']) {
      await fs.writeFile(path.join(dir, name), 'test');
    }
    assert.equal(await checkAzureBuild(env), dir);
  } finally {
    if (path.dirname(dir) !== os.tmpdir()) throw new Error('Ruta temporal fuera del directorio esperado.');
    await fs.rm(dir, { recursive: true, force: true });
  }
});
