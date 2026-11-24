import * as db from './db';
import { apiUrl } from './api-url';
import { createQueueCore } from './queue-core-shared';

export { newAlertId } from './queue-core-shared';

// Solo la app carga este adaptador: db.ts elige SQLite en Android e IndexedDB en la PWA.
export const {
  createLocalAlert,
  mergeServerState,
  flushQueue,
  resumePendingNow,
  pullStatuses,
  syncAll,
  updateAlertDetails,
  cancelAlert,
  markSmsOpened,
  listAlertsSorted,
} = createQueueCore(db, apiUrl);
