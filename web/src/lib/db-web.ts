//Las alertas se guardan aquí

const DB_NAME = 'manguare';
const DB_VERSION = 2;
const ALERTS_STORE = 'alerts';
const BIODIVERSITY_STORE = 'biodiversity-reports';

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
      if (!db.objectStoreNames.contains(ALERTS_STORE)) {
        const alerts = db.createObjectStore(ALERTS_STORE, { keyPath: 'id' });
        alerts.createIndex('state', 'state', { unique: false });
        alerts.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(BIODIVERSITY_STORE)) {
        const reports = db.createObjectStore(BIODIVERSITY_STORE, { keyPath: 'id' });
        reports.createIndex('state', 'state', { unique: false });
        reports.createIndex('createdAt', 'createdAt', { unique: false });
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
  const tx = db.transaction(ALERTS_STORE, 'readonly');
  const store = tx.objectStore(ALERTS_STORE);
  return requestToPromise(store.getAll() as IDBRequest<import('./types').AlertRecord[]>);
}

export async function getAlert(id: string): Promise<import('./types').AlertRecord | undefined> {
  const db = await openDb();
  const tx = db.transaction(ALERTS_STORE, 'readonly');
  return requestToPromise(
    tx.objectStore(ALERTS_STORE).get(id) as IDBRequest<import('./types').AlertRecord | undefined>,
  );
}

export async function putAlert(alert: import('./types').AlertRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(ALERTS_STORE, 'readwrite');
  tx.objectStore(ALERTS_STORE).put(alert);
  await transactionDone(tx);
}

export async function deleteAlert(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(ALERTS_STORE, 'readwrite');
  tx.objectStore(ALERTS_STORE).delete(id);
  await transactionDone(tx);
}

export async function clearAlerts(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(ALERTS_STORE, 'readwrite');
  tx.objectStore(ALERTS_STORE).clear();
  await transactionDone(tx);
}

export async function getAllBiodiversityReports(): Promise<import('./types').BiodiversityReport[]> {
  const db = await openDb();
  const tx = db.transaction(BIODIVERSITY_STORE, 'readonly');
  return requestToPromise(
    tx.objectStore(BIODIVERSITY_STORE).getAll() as IDBRequest<
      import('./types').BiodiversityReport[]
    >,
  );
}

export async function getBiodiversityReport(
  id: string,
): Promise<import('./types').BiodiversityReport | undefined> {
  const db = await openDb();
  const tx = db.transaction(BIODIVERSITY_STORE, 'readonly');
  return requestToPromise(
    tx.objectStore(BIODIVERSITY_STORE).get(id) as IDBRequest<
      import('./types').BiodiversityReport | undefined
    >,
  );
}

export async function putBiodiversityReport(
  report: import('./types').BiodiversityReport,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(BIODIVERSITY_STORE, 'readwrite');
  tx.objectStore(BIODIVERSITY_STORE).put(report);
  await transactionDone(tx);
}

export async function clearBiodiversityReports(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(BIODIVERSITY_STORE, 'readwrite');
  tx.objectStore(BIODIVERSITY_STORE).clear();
  await transactionDone(tx);
}
