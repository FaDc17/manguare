import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import localSchema from '../../../database/01_sqlite.sql?raw';
import * as legacy from './db-web';
import { normalizeSqliteScript } from './sqlite-script';
import type { AlertRecord, BiodiversityReport } from './types';

const DB_NAME = 'manguare';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let connection: Promise<SQLiteDBConnection> | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function rows<T>(result: { values?: unknown[] }): T[] {
  return (result.values ?? []) as T[];
}

async function openNativeDb(): Promise<SQLiteDBConnection> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const consistent = (await sqlite.checkConnectionsConsistency()).result;
  const exists = (await sqlite.isConnection(DB_NAME, false)).result;
  const db = consistent && exists
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  if (!(await db.isDBOpen()).result) await db.open();
  await db.execute('PRAGMA foreign_keys = ON;', false);

  const version = rows<{ user_version: number }>(await db.query('PRAGMA user_version;'))[0]?.user_version ?? 0;
  if (version === 0) await db.execute(normalizeSqliteScript(localSchema), false);
  else if (version !== 1) throw new Error(`Esquema SQLite local no compatible: versión ${version}`);
  const tables = rows<{ name: string }>(await db.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('emergencias', 'cola_sincronizacion');",
  ));
  if (tables.length !== 2) throw new Error('Faltan tablas del esquema SQLite local.');

  // El esquema suministrado no incluye fotos, tokens de edición ni reportes
  // ambientales. Estas tablas los conservan sin alterar sus tablas principales.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_alertas (
      emergencia_id TEXT PRIMARY KEY NOT NULL REFERENCES emergencias(id) ON DELETE CASCADE,
      external_id TEXT NOT NULL UNIQUE,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_usuarios (
      user_key TEXT PRIMARY KEY NOT NULL,
      usuario_id TEXT NOT NULL UNIQUE REFERENCES usuarios(id)
    );
    CREATE TABLE IF NOT EXISTS app_biodiversidad (
      id TEXT PRIMARY KEY NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_meta (
      clave TEXT PRIMARY KEY NOT NULL,
      valor TEXT NOT NULL
    );
  `, false);

  const migrated = rows<{ valor: string }>(await db.query(
    'SELECT valor FROM app_meta WHERE clave = ?;', ['indexeddb_migrated'],
  ))[0]?.valor === '1';
  if (!migrated) {
    // Se copia antes de activar SQLite: si falla, el marcador queda ausente y
    // el siguiente inicio reintenta con INSERT/UPDATE idempotentes.
    for (const alert of await legacy.getAllAlerts()) await putAlertInto(db, alert);
    for (const report of await legacy.getAllBiodiversityReports()) {
      await db.run(
        'INSERT OR REPLACE INTO app_biodiversidad (id, payload_json) VALUES (?, ?);',
        [report.id, JSON.stringify(report)], false,
      );
    }
    await db.run('INSERT INTO app_meta (clave, valor) VALUES (?, ?);', ['indexeddb_migrated', '1'], false);
  }
  return db;
}

function getDb(): Promise<SQLiteDBConnection> {
  if (!connection) connection = openNativeDb().catch((error: unknown) => {
    connection = null;
    throw error;
  });
  return connection;
}

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const result = writeChain.then(work);
  writeChain = result.catch(() => undefined);
  return result;
}

async function userIdFor(db: SQLiteDBConnection, alert: AlertRecord): Promise<string> {
  const key = alert.reporterPhone?.trim() || 'dispositivo-local';
  const existing = rows<{ usuario_id: string }>(await db.query(
    'SELECT usuario_id FROM app_usuarios WHERE user_key = ?;', [key],
  ))[0];
  if (existing) return existing.usuario_id;
  const id = uuid();
  await db.run(
    'INSERT INTO usuarios (id, nombre, idioma_codigo, rol) VALUES (?, ?, ?, ?);',
    [id, alert.reportedBy?.slice(0, 120) ?? null, 'es', 'RESIDENTE'], false,
  );
  await db.run('INSERT INTO app_usuarios (user_key, usuario_id) VALUES (?, ?);', [key, id], false);
  return id;
}

async function putAlertInto(db: SQLiteDBConnection, alert: AlertRecord): Promise<void> {
  await db.beginTransaction();
  try {
    const userId = await userIdFor(db, alert);
    const mapped = rows<{ emergencia_id: string }>(await db.query(
      'SELECT emergencia_id FROM app_alertas WHERE external_id = ?;', [alert.id],
    ))[0];
    const id = mapped?.emergencia_id ?? (UUID.test(alert.id) ? alert.id : uuid());
    const receivedAt = alert.serverReceivedAt ?? null;
    const acknowledgedAt = alert.acknowledgedAt ?? null;
    const state = alert.state === 'received' && receivedAt && acknowledgedAt
      ? 'RECIBIDA'
      : alert.state === 'sent' && receivedAt ? 'ENVIADA' : 'PENDIENTE';
    const version = state === 'RECIBIDA' ? 2 : state === 'ENVIADA' ? 1 : 0;
    const location = alert.consentLocation ? alert.location : undefined;
    const latitude = location?.lat != null && Math.abs(location.lat) <= 90 ? location.lat : null;
    const longitude = location?.lng != null && Math.abs(location.lng) <= 180 ? location.lng : null;
    const lat = latitude !== null && longitude !== null ? latitude : null;
    const lng = latitude !== null && longitude !== null ? longitude : null;
    const values = [
      userId, alert.type.toUpperCase(), alert.note.slice(0, 1000), alert.community.slice(0, 250),
      lat, lng, state, alert.createdAt, state === 'PENDIENTE' ? null : receivedAt,
      state === 'RECIBIDA' ? acknowledgedAt : null,
      state === 'PENDIENTE' ? null : state === 'RECIBIDA' ? acknowledgedAt : receivedAt, version,
    ];
    if (mapped) {
      await db.run(`UPDATE emergencias SET usuario_id=?, tipo_codigo=?, descripcion=?,
        referencia_ubicacion=?, latitud=?, longitud=?, estado=?, creada_dispositivo_utc=?,
        recibida_servidor_utc=?, confirmada_receptor_utc=?, actualizada_servidor_utc=?,
        version_servidor=? WHERE id=?;`, [...values, id], false);
    } else {
      await db.run(`INSERT INTO emergencias (
        id, usuario_id, tipo_codigo, descripcion, referencia_ubicacion, latitud, longitud,
        estado, creada_dispositivo_utc, recibida_servidor_utc, confirmada_receptor_utc,
        actualizada_servidor_utc, version_servidor
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`, [id, ...values], false);
    }
    await db.run(`INSERT INTO app_alertas (emergencia_id, external_id, payload_json)
      VALUES (?, ?, ?) ON CONFLICT(emergencia_id) DO UPDATE SET payload_json=excluded.payload_json;`,
    [id, alert.id, JSON.stringify(alert)], false);
    if (state === 'PENDIENTE') {
      await db.run(`INSERT INTO cola_sincronizacion (
        emergencia_id, intentos, siguiente_intento_utc, ultimo_error_codigo, bloqueada
      ) VALUES (?, ?, ?, ?, ?) ON CONFLICT(emergencia_id) DO UPDATE SET
        intentos=excluded.intentos, siguiente_intento_utc=excluded.siguiente_intento_utc,
        ultimo_error_codigo=excluded.ultimo_error_codigo, bloqueada=excluded.bloqueada;`,
      [id, alert.attempts, alert.nextAttemptAt ?? alert.createdAt,
        alert.lastError?.slice(0, 80) ?? null, alert.state === 'canceled' ? 1 : 0], false);
    } else {
      await db.run(`UPDATE cola_sincronizacion SET sincronizada_utc=?, bloqueada=0
        WHERE emergencia_id=?;`, [receivedAt, id], false);
    }
    await db.commitTransaction();
  } catch (error) {
    await db.rollbackTransaction().catch(() => undefined);
    throw error;
  }
}

interface AlertRow {
  payload_json: string;
  tipo_codigo: string;
  descripcion: string | null;
  referencia_ubicacion: string | null;
  latitud: number | null;
  longitud: number | null;
  estado: 'PENDIENTE' | 'ENVIADA' | 'RECIBIDA' | 'EN_ATENCION' | 'ATENDIDA';
  creada_dispositivo_utc: string;
  recibida_servidor_utc: string | null;
  confirmada_receptor_utc: string | null;
  intentos: number | null;
  siguiente_intento_utc: string | null;
  bloqueada: number | null;
}

const alertSelect = `SELECT a.payload_json, e.tipo_codigo, e.descripcion,
  e.referencia_ubicacion, e.latitud, e.longitud, e.estado,
  e.creada_dispositivo_utc, e.recibida_servidor_utc, e.confirmada_receptor_utc,
  c.intentos, c.siguiente_intento_utc, c.bloqueada
  FROM app_alertas a JOIN emergencias e ON e.id = a.emergencia_id
  LEFT JOIN cola_sincronizacion c ON c.emergencia_id = e.id`;

function decodeAlert(row: AlertRow): AlertRecord {
  const payload = JSON.parse(row.payload_json) as AlertRecord;
  const state = row.estado === 'PENDIENTE'
    ? row.bloqueada === 1 || payload.state === 'canceled' ? 'canceled' : 'pending'
    : row.estado === 'ENVIADA' ? 'sent' : 'received';
  return {
    ...payload,
    type: row.tipo_codigo.toLowerCase() as AlertRecord['type'],
    note: row.descripcion ?? '',
    community: row.referencia_ubicacion ?? '',
    location: row.latitud !== null && row.longitud !== null && payload.location
      ? { ...payload.location, lat: row.latitud, lng: row.longitud } : undefined,
    state,
    createdAt: row.creada_dispositivo_utc,
    serverReceivedAt: row.recibida_servidor_utc ?? undefined,
    acknowledgedAt: row.confirmada_receptor_utc ?? undefined,
    attempts: state === 'pending' ? row.intentos ?? payload.attempts : payload.attempts,
    nextAttemptAt: state === 'pending' ? row.siguiente_intento_utc ?? undefined : undefined,
  };
}

export async function getAllAlerts(): Promise<AlertRecord[]> {
  await writeChain;
  const db = await getDb();
  const result = await db.query(`${alertSelect};`);
  return rows<AlertRow>(result).map(decodeAlert);
}

export async function getAlert(id: string): Promise<AlertRecord | undefined> {
  await writeChain;
  const db = await getDb();
  const result = await db.query(`${alertSelect} WHERE a.external_id = ?;`, [id]);
  const row = rows<AlertRow>(result)[0];
  return row ? decodeAlert(row) : undefined;
}

export async function putAlert(alert: AlertRecord): Promise<void> {
  return serialize(async () => putAlertInto(await getDb(), alert));
}

export async function deleteAlert(id: string): Promise<void> {
  return serialize(async () => {
    const db = await getDb();
    const mapped = rows<{ emergencia_id: string }>(await db.query(
      'SELECT emergencia_id FROM app_alertas WHERE external_id = ?;', [id],
    ))[0];
    if (mapped) await db.run('DELETE FROM emergencias WHERE id = ?;', [mapped.emergencia_id]);
  });
}

export async function clearAlerts(): Promise<void> {
  return serialize(async () => { await (await getDb()).execute('DELETE FROM emergencias;', false); });
}

export async function getAllBiodiversityReports(): Promise<BiodiversityReport[]> {
  await writeChain;
  const result = await (await getDb()).query('SELECT payload_json FROM app_biodiversidad;');
  return rows<{ payload_json: string }>(result).map((row) => JSON.parse(row.payload_json) as BiodiversityReport);
}

export async function getBiodiversityReport(id: string): Promise<BiodiversityReport | undefined> {
  await writeChain;
  const result = await (await getDb()).query('SELECT payload_json FROM app_biodiversidad WHERE id = ?;', [id]);
  const row = rows<{ payload_json: string }>(result)[0];
  return row ? JSON.parse(row.payload_json) as BiodiversityReport : undefined;
}

export async function putBiodiversityReport(report: BiodiversityReport): Promise<void> {
  return serialize(async () => {
    await (await getDb()).run(`INSERT INTO app_biodiversidad (id, payload_json) VALUES (?, ?)
      ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json;`, [report.id, JSON.stringify(report)]);
  });
}

export async function clearBiodiversityReports(): Promise<void> {
  return serialize(async () => { await (await getDb()).execute('DELETE FROM app_biodiversidad;', false); });
}
