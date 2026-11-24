import { connectAzureSql } from '../server/src/azure-sql.js';

const pool = await connectAzureSql();
try {
  const result = await pool.request().query(`
    SELECT DB_NAME() AS database_name,
      OBJECT_ID(N'dbo.manguare_app_state', N'U') AS app_state_id,
      HAS_PERMS_BY_NAME(N'dbo.manguare_app_state', N'OBJECT', N'SELECT') AS can_select,
      HAS_PERMS_BY_NAME(N'dbo.manguare_app_state', N'OBJECT', N'INSERT') AS can_insert,
      HAS_PERMS_BY_NAME(N'dbo.manguare_app_state', N'OBJECT', N'UPDATE') AS can_update
  `);
  const row = result.recordset[0];
  if (row?.database_name !== 'manguara_bd') {
    throw new Error('La conexión no está usando la base manguara_bd.');
  }
  if (!row.app_state_id || row.can_select !== 1 || row.can_insert !== 1 || row.can_update !== 1) {
    throw new Error('Falta dbo.manguare_app_state o alguno de los permisos SELECT, INSERT y UPDATE.');
  }
  process.stdout.write('Azure SQL manguara_bd: tabla y permisos correctos.\n');
} finally {
  await pool.close();
}
