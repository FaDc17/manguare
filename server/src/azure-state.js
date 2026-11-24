import sql from 'mssql';

/** One SQL row per existing server store. A revision prevents silent overwrites
 * if a second API instance starts with an older snapshot. */
export class AzureStateStorage {
  constructor(pool, name) {
    if (!['alerts', 'biodiversity', 'social'].includes(name)) {
      throw new Error('Nombre de almacén Azure SQL inválido.');
    }
    this.pool = pool;
    this.name = name;
    this.revision = 0;
    this.invalid = false;
  }

  #request() {
    return this.pool.request().input('name', sql.VarChar(32), this.name);
  }

  async load() {
    const result = await this.#request().query(
      'SELECT revision, payload FROM dbo.manguare_app_state WHERE name = @name',
    );
    const row = result.recordset[0];
    this.revision = row ? Number(row.revision) : 0;
    return row ? JSON.parse(row.payload) : null;
  }

  async save(snapshot) {
    if (this.invalid) {
      throw new Error('El almacén Azure SQL requiere reiniciar la API tras un fallo de escritura.');
    }
    try {
      await this.#save(snapshot);
    } catch (error) {
      // Other queued snapshots were made from the old in-memory state.
      // A restart reloads the authoritative SQL row before any new write.
      this.invalid = true;
      throw error;
    }
  }

  async #save(snapshot) {
    const payload = JSON.stringify(snapshot);
    if (this.revision === 0) {
      const result = await this.#request()
        .input('payload', sql.NVarChar(sql.MAX), payload)
        .query(`
          INSERT dbo.manguare_app_state (name, revision, payload)
          SELECT @name, 1, @payload
          WHERE NOT EXISTS (
            SELECT 1 FROM dbo.manguare_app_state WITH (UPDLOCK, HOLDLOCK)
            WHERE name = @name
          )`);
      if (result.rowsAffected[0] !== 1) {
        throw new Error('El almacén Azure SQL cambió; vuelve a cargar los datos.');
      }
      this.revision = 1;
      return;
    }
    const result = await this.#request()
      .input('revision', sql.BigInt, this.revision)
      .input('payload', sql.NVarChar(sql.MAX), payload)
      .query(`
        UPDATE dbo.manguare_app_state
        SET payload = @payload, revision = revision + 1, updated_utc = SYSUTCDATETIME()
        WHERE name = @name AND revision = @revision`);
    if (result.rowsAffected[0] !== 1) {
      throw new Error('El almacén Azure SQL cambió; vuelve a cargar los datos.');
    }
    this.revision += 1;
  }
}
