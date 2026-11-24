import assert from 'node:assert/strict';
import test from 'node:test';
import { azureSqlConfig } from '../src/azure-sql.js';

test('Azure SQL queda inactivo sin servidor y base configurados', () => {
  assert.throws(() => azureSqlConfig({}), /AZURE_SQL_SERVER/);
  assert.throws(() => azureSqlConfig({
    AZURE_SQL_SERVER: 'sql-kuska-fadc.database.windows.net',
    AZURE_SQL_DATABASE: 'otra-base',
  }), /debe ser manguara_bd/);
});

test('la conexión preparada exige TLS e identidad de Microsoft Entra', () => {
  const config = azureSqlConfig({
    AZURE_SQL_SERVER: 'sql-kuska-fadc.database.windows.net',
    AZURE_SQL_DATABASE: 'manguara_bd',
  });
  assert.equal(config.database, 'manguara_bd');
  assert.equal(config.port, 1433);
  assert.deepEqual(config.authentication, { type: 'azure-active-directory-default' });
  assert.deepEqual(config.options, { encrypt: true, trustServerCertificate: false });
  assert.throws(() => azureSqlConfig({
    AZURE_SQL_SERVER: 'sql-kuska-fadc.database.windows.net',
    AZURE_SQL_DATABASE: 'manguara_bd',
    AZURE_SQL_AUTHENTICATIONTYPE: 'default',
  }), /identidad administrada/);
});
