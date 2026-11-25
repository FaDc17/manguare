import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const windows = process.platform === 'win32';
const productionApiBase = 'https://manguare-services-c9hpebgcduf0gfdr.eastus2-01.azurewebsites.net';

function run(command, args, cwd = root) {
  const result = windows
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', [command, ...args].join(' ')], { cwd, stdio: 'inherit' })
    : spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!['sync', 'apk'].includes(process.argv[2])) {
  throw new Error('Uso: node scripts/android.mjs sync|apk');
}

if (process.argv[2] === 'apk') {
  process.env.MANGUARE_LOCAL_MVP = '1';
  process.env.VITE_LOCAL_MVP = '1';
  if (!process.env.VITE_API_BASE_URL?.trim()) {
    process.env.VITE_API_BASE_URL = productionApiBase;
  }
}

run(windows ? 'npm.cmd' : 'npm', ['run', 'build']);
run(windows ? 'npx.cmd' : 'npx', ['cap', 'sync', 'android']);

if (process.argv[2] === 'apk') {
  run(windows ? 'gradlew.bat' : './gradlew', ['assembleDebug'], path.join(root, 'android'));
  const apk = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  if (!existsSync(apk)) throw new Error('Gradle terminó sin producir el APK de prueba.');
  process.stdout.write(`APK de prueba: ${apk}\n`);
}
