import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { createHandler } from '../server/src/app.js';
import { createAuth } from '../server/src/auth.js';
import { AlertStore } from '../server/src/store.js';

process.env.MANGUARE_LOG = '0';
process.env.MANGUARE_STATS_DEMO = '1';
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'manguare-statistics-ui-'));
const store = new AlertStore(path.join(directory, 'alerts.json'));
await store.add({
  id: 'statistics-smoke-0001', type: 'enfermedad', note: 'Prueba', community: 'Prueba',
  deviceName: 'Prueba', consentLocation: false,
  clientCreatedAt: new Date().toISOString(), serverReceivedAt: new Date().toISOString(),
});
const staticDir = path.resolve('web/dist');
const auth = createAuth({ enabled: true, password: 'smoke-secret' });
const server = http.createServer(createHandler({ store, staticDir, auth }));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const candidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].filter(Boolean);
const browserPath = (await Promise.all(candidates.map(async (candidate) => {
  try { await fs.access(candidate); return candidate; } catch { return null; }
}))).find(Boolean);
if (!browserPath) throw new Error('No se encontró Chrome o Edge. Define CHROME_PATH.');
const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.goto(`${base}/panel`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-testid="login-password"]');
  assert.equal(await page.$('[data-testid="statistics-section"]'), null);
  await page.type('[data-testid="login-password"]', 'smoke-secret');
  await page.click('[data-testid="login-submit"]');
  await page.waitForSelector('[data-testid="statistics-section"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="statistics-total"]')?.textContent === '1');
  await page.select('[data-testid="statistics-period"]', 'custom');
  const inputs = await page.$$('input[type="date"]');
  assert.equal(inputs.length, 2);
  await inputs[0].type('2020-01-01');
  await inputs[1].type('2020-01-31');
  await page.waitForFunction(() => document.querySelector('[data-testid="statistics-total"]')?.textContent === '0');
  await page.select('[data-testid="statistics-period"]', 'last7');
  await page.waitForFunction(() => document.querySelector('[data-testid="statistics-total"]')?.textContent === '1');
  await page.click('[data-testid="statistics-demo"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="statistics-total"]')?.textContent === '2');
  await page.click('[data-testid="statistics-demo"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="statistics-total"]')?.textContent === '1');
  const cookies = await page.cookies();
  const response = await fetch(`${base}/api/panel/statistics/export?period=last7`, {
    headers: { Cookie: cookies.map((item) => `${item.name}=${item.value}`).join('; ') },
  });
  assert.equal(response.status, 200);
  const workbook = Buffer.from(await response.arrayBuffer());
  assert.ok(workbook.length > 1000);
  const file = path.join(directory, 'report.xlsx');
  await fs.writeFile(file, workbook);
  const entries = execFileSync('tar', ['-tf', file], { encoding: 'utf8' });
  assert.match(entries, /xl\/worksheets\/sheet3.xml/);
  assert.equal(await page.$eval('[data-testid="statistics-export"]', (button) => button.disabled), false);
  console.log('Panel, filtros y descarga Excel: correctos.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(directory, { recursive: true, force: true });
}
