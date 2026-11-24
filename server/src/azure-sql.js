// Conector Azure SQL para el almacén actual de la API.

export function azureSqlConfig(env = process.env) {
  const server = env.AZURE_SQL_SERVER?.trim();
  const database = env.AZURE_SQL_DATABASE?.trim();
  if (!server || !database) {
    throw new Error('Configura AZURE_SQL_SERVER y AZURE_SQL_DATABASE antes de conectar Azure SQL.');
  }
  if (database !== 'manguara_bd') {
    throw new Error('AZURE_SQL_DATABASE debe ser manguara_bd.');
  }
  const port = Number(env.AZURE_SQL_PORT || 1433);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('AZURE_SQL_PORT debe ser un puerto válido.');
  }
  const authenticationType = env.AZURE_SQL_AUTHENTICATIONTYPE || 'azure-active-directory-default';
  if (authenticationType !== 'azure-active-directory-default') {
    throw new Error('Esta integración solo admite identidad administrada de Microsoft Entra.');
  }
  return {
    server,
    database,
    port,
    authentication: { type: authenticationType },
    options: { encrypt: true, trustServerCertificate: false },
  };
}

export async function connectAzureSql(env = process.env) {
  const config = azureSqlConfig(env);
  const { default: sql } = await import('mssql');
  const pool = new sql.ConnectionPool(config);
  await pool.connect();
  return pool;
}
