const DB_NAME = 'manguare';
const DB_VERSION = 1;
const STORE = 'alerts';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible en este navegador.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('state', 'state', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir la base local.'));
  });

  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Error de almacenamiento local.'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Error de almacenamiento local.'));
    tx.onabort = () => reject(tx.error ?? new Error('Transacción cancelada.'));
  });
}

export async function getAllAlerts(): Promise<import('./types').AlertRecord[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  return requestToPromise(store.getAll() as IDBRequest<import('./types').AlertRecord[]>);
}

export async function getAlert(id: string): Promise<import('./types').AlertRecord | undefined> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  return requestToPromise(
    tx.objectStore(STORE).get(id) as IDBRequest<import('./types').AlertRecord | undefined>,
  );
}

export async function putAlert(alert: import('./types').AlertRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(alert);
  await transactionDone(tx);
}

export async function deleteAlert(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  await transactionDone(tx);
}

export async function clearAlerts(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).clear();
  await transactionDone(tx);
}
