import assert from 'node:assert/strict';
import test from 'node:test';
import { AzureStateStorage } from '../src/azure-state.js';
import { AlertStore } from '../src/store.js';

function fakePool() {
  const rows = new Map();
  return {
    request() {
      const args = {};
      return {
        input(key, _type, value) {
          args[key] = value;
          return this;
        },
        async query(query) {
          const current = rows.get(args.name);
          if (query.includes('SELECT revision, payload')) {
            return { recordset: current ? [current] : [] };
          }
          if (query.includes('INSERT dbo.manguare_app_state')) {
            if (current) return { rowsAffected: [0] };
            rows.set(args.name, { revision: 1, payload: args.payload });
            return { rowsAffected: [1] };
          }
          if (query.includes('UPDATE dbo.manguare_app_state')) {
            if (!current || current.revision !== args.revision) return { rowsAffected: [0] };
            rows.set(args.name, { revision: current.revision + 1, payload: args.payload });
            return { rowsAffected: [1] };
          }
          throw new Error('Consulta inesperada');
        },
      };
    },
  };
}

test('las alertas, incluida una foto, sobreviven a reiniciar el almacén Azure SQL', async () => {
  const pool = fakePool();
  const first = new AlertStore('unused', { storage: new AzureStateStorage(pool, 'alerts') });
  await first.add({ id: 'alert-1', note: 'Detalle', photo: 'data:image/jpeg;base64,AA==' });
  const restarted = new AlertStore('unused', { storage: new AzureStateStorage(pool, 'alerts') });
  assert.deepEqual(await restarted.get('alert-1'), {
    id: 'alert-1', note: 'Detalle', photo: 'data:image/jpeg;base64,AA==',
  });
});

test('una segunda instancia no sobrescribe una revisión más reciente', async () => {
  const pool = fakePool();
  const first = new AzureStateStorage(pool, 'alerts');
  const second = new AzureStateStorage(pool, 'alerts');
  assert.equal(await first.load(), null);
  assert.equal(await second.load(), null);
  await first.save({ alerts: [{ id: 'one' }] });
  await assert.rejects(second.save({ alerts: [{ id: 'two' }] }), /cambió/);
  assert.deepEqual(await second.load(), { alerts: [{ id: 'one' }] });
  await assert.rejects(second.save({ alerts: [{ id: 'two' }] }), /reiniciar/);
});
