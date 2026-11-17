import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { clearAlerts } from '../lib/db';
import { markSmsOpened, listAlertsSorted, createLocalAlert } from '../lib/queue-core';
import {
  isEffectivelyOnline,
  notifyQueueChanged,
  QUEUE_CHANGED_EVENT,
  requestBackgroundSync,
  runSync,
} from '../lib/sync';
import {
  loadSettings,
  saveSettings,
  type Settings,
} from '../lib/settings';
import type { AlertDraft, AlertRecord } from '../lib/types';

type ToastTone = 'ok' | 'warn' | 'error';

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface AppContextValue {
  alerts: AlertRecord[];
  loading: boolean;
  syncing: boolean;
  online: boolean;
  realOnline: boolean;
  settings: Settings;
  toast: ToastState | null;
  showToast: (message: string, tone?: ToastTone) => void;
  dismissToast: () => void;
  refresh: () => Promise<void>;
  createAlert: (draft: AlertDraft) => Promise<AlertRecord>;
  syncNow: (manual?: boolean) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
  markSms: (id: string) => Promise<void>;
  clearLocal: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [realOnline, setRealOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<number | null>(null);
  const syncingRef = useRef(false);

  const online = realOnline && !settings.simulateOffline;

  const showToast = useCallback((message: string, tone: ToastTone = 'ok') => {
    setToast({ id: Date.now(), message, tone });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const list = await listAlertsSorted();
      setAlerts(list);
    } catch {
      showToast('No se pudo leer el almacenamiento del teléfono.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const syncNow = useCallback(
    async (manual = false) => {
      if (syncingRef.current) return;
      if (!isEffectivelyOnline()) {
        if (manual) {
          showToast('Sin conexión. La alerta se enviará cuando vuelva la señal.', 'warn');
        }
        return;
      }
      syncingRef.current = true;
      setSyncing(true);
      try {
        const result = await runSync();
        await refresh();
        if (manual) {
          if (!result) {
            showToast('No se pudo conectar. Se reintentará automáticamente.', 'error');
          } else if (result.sent > 0) {
            showToast(
              result.sent === 1 ? 'Alerta enviada.' : `${result.sent} alertas enviadas.`,
              'ok',
            );
          } else if (result.failed > 0) {
            showToast('No se pudo enviar. Se reintentará automáticamente.', 'warn');
          } else if (result.updated > 0) {
            showToast('Estado actualizado.', 'ok');
          } else {
            showToast('Todo está al día.', 'ok');
          }
        }
      } finally {
        syncingRef.current = false;
        setSyncing(false);
      }
    },
    [refresh, showToast],
  );

  const createAlert = useCallback(
    async (draft: AlertDraft) => {
      const alert = await createLocalAlert(draft);
      await refresh();
      notifyQueueChanged();
      void requestBackgroundSync();
      if (isEffectivelyOnline()) {
        void (async () => {
          setSyncing(true);
          try {
            await runSync();
            await refresh();
          } finally {
            setSyncing(false);
          }
        })();
      }
      return alert;
    },
    [refresh],
  );

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const markSms = useCallback(
    async (id: string) => {
      try {
        await markSmsOpened(id);
        await refresh();
      } catch {
        // No es crítico: el estado local del SMS es informativo.
      }
    },
    [refresh],
  );

  const clearLocal = useCallback(async () => {
    await clearAlerts();
    await refresh();
    showToast('Se borraron las alertas de este teléfono.', 'ok');
  }, [refresh, showToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const update = () => setRealOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    const onQueueChanged = () => {
      void refresh();
    };
    window.addEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);
    return () => window.removeEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);
  }, [refresh]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'manguare:sync-done') {
        void refresh();
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [refresh]);

  useEffect(() => {
    if (!online) return;

    let disposed = false;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      if (syncingRef.current) return;
      syncingRef.current = true;
      setSyncing(true);
      try {
        await runSync();
        if (!disposed) await refresh();
      } finally {
        if (!disposed) {
          syncingRef.current = false;
          setSyncing(false);
        }
      }
    };

    void tick();
    const interval = window.setInterval(() => void tick(), 20_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [online, refresh]);

  const value = useMemo<AppContextValue>(
    () => ({
      alerts,
      loading,
      syncing,
      online,
      realOnline,
      settings,
      toast,
      showToast,
      dismissToast,
      refresh,
      createAlert,
      syncNow,
      updateSettings,
      markSms,
      clearLocal,
    }),
    [
      alerts,
      loading,
      syncing,
      online,
      realOnline,
      settings,
      toast,
      showToast,
      dismissToast,
      refresh,
      createAlert,
      syncNow,
      updateSettings,
      markSms,
      clearLocal,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp debe usarse dentro de AppProvider');
  return context;
}
