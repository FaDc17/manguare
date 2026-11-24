import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await fs.readFile(path.join(root, 'database', '02_azure_sql.sql'), 'utf8');
const appState = await fs.readFile(path.join(root, 'database', '03_azure_app_state.sql'), 'utf8');
const base = source.split(/^GO\s*$/m)[0];
const tables = [...base.matchAll(/^CREATE TABLE dbo\.([a-z_]+) \([\s\S]*?^\);/gm)]
  .map((match) => ({ name: match[1], sql: match[0] }));
const indexes = [...base.matchAll(/^CREATE INDEX ([A-Za-z_]+) ON dbo\.([a-z_]+)\([^\n]+\);/gm)]
  .map((match) => ({ name: match[1], table: match[2], sql: match[0] }));
const procedures = source.split(/^GO\s*$/m)
  .filter((section) => section.includes('CREATE OR ALTER PROCEDURE'))
  .map((section) => section.slice(section.indexOf('CREATE OR ALTER PROCEDURE')).trim());
const roleGrants = [...source.matchAll(/^GRANT .+ TO manguare_api;$/gm)].map((match) => match[0]);
const appTable = appState.match(/^    CREATE TABLE dbo\.manguare_app_state \([\s\S]*?^    \);/m)?.[0]?.trim();

if (tables.length !== 8 || indexes.length !== 4 || procedures.length !== 5 ||
    roleGrants.length !== 9 || !appTable) {
  throw new Error('El esquema fuente cambió; revisa el generador antes de crear el SQL completo.');
}

const chunks = [
  '-- Manguaré | esquema completo para Azure SQL Database manguara_bd.',
  '-- Generado desde 02_azure_sql.sql y 03_azure_app_state.sql.',
  '-- Crea objetos faltantes y catálogos; no elimina ni sobrescribe datos existentes.',
  '-- Las cuentas demo viven en la app. No se inventan usuarios, centros ni alertas.',
  '-- Si ya existe una tabla incompatible, revisar su esquema antes de continuar.',
  "IF DB_NAME() <> N'manguara_bd'",
  "    THROW 51030, 'Conectar a manguara_bd antes de ejecutar este script.', 1;",
  'SET XACT_ABORT ON;',
  'BEGIN TRY',
  '    BEGIN TRANSACTION;',
];

for (const table of tables) {
  chunks.push(`    IF OBJECT_ID(N'dbo.${table.name}', N'U') IS NULL\n    BEGIN\n${table.sql.split('\n').map((line) => `        ${line}`).join('\n')}\n    END;`);
  if (table.name === 'idiomas') {
    for (const [code, label] of [['es', 'Español'], ['agr', 'Awajún'], ['cbt', 'Shawi']]) {
      chunks.push(`    IF NOT EXISTS (SELECT 1 FROM dbo.idiomas WHERE codigo = '${code}')\n        INSERT dbo.idiomas(codigo, nombre) VALUES ('${code}', N'${label}');`);
    }
  }
  if (table.name === 'tipos_emergencia') {
    for (const [code, label] of [
      ['ENFERMEDAD', 'Enfermedad'], ['ACCIDENTE', 'Accidente'],
      ['MORDEDURA', 'Mordedura'], ['PARTO', 'Parto'], ['OTRO', 'Otro'],
    ]) {
      chunks.push(`    IF NOT EXISTS (SELECT 1 FROM dbo.tipos_emergencia WHERE codigo = '${code}')\n        INSERT dbo.tipos_emergencia(codigo, nombre) VALUES ('${code}', N'${label}');`);
    }
  }
}

chunks.push(`    IF OBJECT_ID(N'dbo.manguare_app_state', N'U') IS NULL\n    BEGIN\n${appTable.split('\n').map((line) => `        ${line}`).join('\n')}\n    END;`);
for (const index of indexes) {
  chunks.push(`    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.${index.table}') AND name = N'${index.name}')\n        ${index.sql}`);
}
chunks.push(
  '    COMMIT;',
  'END TRY',
  'BEGIN CATCH',
  '    IF XACT_STATE() <> 0 ROLLBACK;',
  '    THROW;',
  'END CATCH;',
  '',
  ...procedures.map((procedure) => `EXEC(N'${procedure.replaceAll("'", "''")}');`),
  '',
  "IF DATABASE_PRINCIPAL_ID(N'manguare_api') IS NULL",
  '    CREATE ROLE manguare_api;',
  ...roleGrants,
  '',
  "SELECT DB_NAME() AS base_de_datos,",
  "       (SELECT COUNT(*) FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo') AND name IN",
  "        (N'idiomas', N'comunidades', N'centros_salud', N'usuarios', N'usuarios_centros',",
  "         N'tipos_emergencia', N'emergencias', N'historial_estados', N'manguare_app_state')) AS tablas_presentes,",
  "       (SELECT COUNT(*) FROM dbo.idiomas) AS idiomas,",
  "       (SELECT COUNT(*) FROM dbo.tipos_emergencia) AS tipos_emergencia;",
  '',
  '-- Después, con una cuenta administradora Entra, ejecutar 04_azure_identity.sql.',
  '-- La API actual usa dbo.manguare_app_state. El esquema relacional y sus procedimientos',
  '-- quedan preparados, pero no se usan hasta definir identidad y centros reales.',
  '',
);

const output = `${chunks.join('\n\n').trimEnd()}\n`;
await fs.writeFile(path.join(root, 'database', '05_azure_manguara_complete.sql'), output, 'utf8');
process.stdout.write('Generado database/05_azure_manguara_complete.sql\n');

// Archivo de carga simple para una base vacía: solo tablas y filas de catálogo.
// No comprueba el nombre de la base ni configura identidades, roles o API.
const simpleChunks = [
  '-- Manguaré: únicamente tablas y datos de catálogo para una base Azure SQL vacía.',
  '-- También sirve si se borraron solo las filas y se conservaron las tablas.',
  '-- Ejecutar en la base seleccionada en el editor. No comprueba ni cambia su nombre.',
  '-- No crea cuentas de usuario, centros o alertas ficticias.',
  'SET XACT_ABORT ON;',
  'BEGIN TRY',
  '    BEGIN TRANSACTION;',
];
for (const table of tables) {
  simpleChunks.push(`    IF OBJECT_ID(N'dbo.${table.name}', N'U') IS NULL\n    BEGIN\n${table.sql.split('\n').map((line) => `        ${line}`).join('\n')}\n    END;`);
  if (table.name === 'idiomas') {
    for (const [code, label] of [['es', 'Español'], ['agr', 'Awajún'], ['cbt', 'Shawi']]) {
      simpleChunks.push(`    IF NOT EXISTS (SELECT 1 FROM dbo.idiomas WHERE codigo = '${code}')\n        INSERT dbo.idiomas(codigo, nombre) VALUES ('${code}', N'${label}');`);
    }
  }
  if (table.name === 'tipos_emergencia') {
    for (const [code, label] of [
      ['ENFERMEDAD', 'Enfermedad'], ['ACCIDENTE', 'Accidente'],
      ['MORDEDURA', 'Mordedura'], ['PARTO', 'Parto'], ['OTRO', 'Otro'],
    ]) {
      simpleChunks.push(`    IF NOT EXISTS (SELECT 1 FROM dbo.tipos_emergencia WHERE codigo = '${code}')\n        INSERT dbo.tipos_emergencia(codigo, nombre) VALUES ('${code}', N'${label}');`);
    }
  }
}
simpleChunks.push(
  `    IF OBJECT_ID(N'dbo.manguare_app_state', N'U') IS NULL\n    BEGIN\n${appTable.split('\n').map((line) => `        ${line}`).join('\n')}\n    END;`,
  '    COMMIT;',
  'END TRY',
  'BEGIN CATCH',
  '    IF XACT_STATE() <> 0 ROLLBACK;',
  '    THROW;',
  'END CATCH;',
  '',
);
const simple = `${simpleChunks.join('\n\n').trimEnd()}\n`;
await fs.writeFile(path.join(root, 'database', '06_solo_tablas_y_datos.sql'), simple, 'utf8');
process.stdout.write('Generado database/06_solo_tablas_y_datos.sql\n');
