import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectAzureSql } from '../server/src/azure-sql.js';
import { AzureStateStorage } from '../server/src/azure-state.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = {
  alerts: process.env.MANGUARE_DATA_FILE ?? path.join(root, 'server', 'data', 'alerts.json'),
  biodiversity: process.env.MANGUARE_BIODIVERSITY_FILE ?? path.join(root, 'server', 'data', 'biodiversity.json'),
  social: process.env.MANGUARE_SOCIAL_FILE ?? path.join(root, 'server', 'data', 'social.json'),
};
const expected = { alerts: 'alerts', biodiversity: 'reports', social: 'posts' };

const pool = await connectAzureSql();
try {
  for (const [name, file] of Object.entries(files)) {
    let contents;
    try {
      contents = await fs.readFile(file, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        process.stdout.write(`${name}: no hay archivo para importar\n`);
        continue;
      }
      throw error;
    }
    const data = JSON.parse(contents);
    if (!data || !Array.isArray(data[expected[name]]) ||
        (name === 'social' && !Array.isArray(data.listings))) {
      throw new Error(`${name}: formato JSON inválido; no se importó.`);
    }
    const storage = new AzureStateStorage(pool, name);
    if (await storage.load()) {
      process.stdout.write(`${name}: Azure SQL ya contiene datos; se conservan sin sobrescribir\n`);
      continue;
    }
    await storage.save(data);
    process.stdout.write(`${name}: importado en Azure SQL\n`);
  }
} finally {
  await pool.close();
}
