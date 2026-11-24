import * as db from './db-web';
import { createQueueCore } from './queue-core-shared';

// El Service Worker solo dispone de IndexedDB y de rutas API relativas.
export const { syncAll } = createQueueCore(db, (path) => path);
