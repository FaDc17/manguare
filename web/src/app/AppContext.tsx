import { message, type Message } from '../i18n/catalog';
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
import { clearAlerts, clearBiodiversityReports, getAllBiodiversityReports } from '../lib/db';
import { createLocalBiodiversityReport } from '../lib/biodiversity';
import {
  cancelAlert as cancelLocalAlert,
  createLocalAlert,
  listAlertsSorted,
  markSmsOpened,
  updateAlertDetails as saveAlertDetails,
} from '../lib/queue-core';
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
import type {
  AlertDraft,
  AlertRecord,
  BiodiversityReport,
  BiodiversityReportDraft,
} from '../lib/types';

type ToastTone = 'ok' | 'warn' | 'error';

interface ToastState {
  id: number;
  message: string | Message;
  tone: ToastTone;
}

interface AppContextValue {
  alerts: AlertRecord[];
  biodiversityReports: BiodiversityReport[];
  loading: boolean;
  syncing: boolean;
  online: boolean;
  realOnline: boolean;
  settings: Settings;
  toast: ToastState | null;
  showToast: (message: string | Message, tone?: ToastTone) => void;
  dismissToast: () => void;
  refresh: () => Promise<void>;
  createAlert: (draft: AlertDraft) => Promise<AlertRecord>;
  updateAlertDetails: (
    id: string,
    details: {
      note: string;
      community: string;
      location?: AlertRecord['location'];
      photo?: string;
    },
  ) => Promise<void>;
  createBiodiversityReport: (draft: BiodiversityReportDraft) => Promise<BiodiversityReport>;
  cancelAlert: (id: string) => Promise<boolean>;
  syncNow: (manual?: boolean) => Promise<void>;
  updateSettings: (patch: Partial<Omit<Settings, 'language'>>) => void;
  markSms: (id: string) => Promise<void>;
  clearLocal: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [biodiversityReports, setBiodiversityReports] = useState<BiodiversityReport[]>([]);
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

  const showToast = useCallback((message: string | Message, tone: ToastTone = 'ok') => {
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
      const [list, reports] = await Promise.all([
        listAlertsSorted(),
        getAllBiodiversityReports(),
      ]);
      setAlerts(list);
      setBiodiversityReports(reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch {
      showToast(message('sync.noSePudoLeerElAlmacenamiento'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const syncNow = useCallback(
    async (manual = false) => {
      if (syncingRef.current) return;
      if (!isEffectivelyOnline()) {
        if (manual) {
          showToast(message('sync.sinConexionLaAlertaSeEnviara'), 'warn');
        }
        return;
      }
      syncingRef.current = true;
      setSyncing(true);
      try {
        const result = await runSync(manual);
        await refresh();
        if (manual) {
          if (!result) {
            showToast(message('sync.noSePudoConectarSeReintentara'), 'error');
          } else if (result.sent > 0) {
            showToast(
              result.sent === 1 ? message('sync.alertaEnviada') : message('sync.alertasEnviadas', { sent: result.sent }),
              'ok',
            );
          } else if (result.failed > 0) {
            showToast(message('sync.noSePudoEnviarSeReintentara'), 'warn');
          } else if (result.updated > 0) {
            showToast(message('sync.estadoActualizado'), 'ok');
          } else {
            showToast(message('sync.todoEstaAlDia'), 'ok');
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
            await runSync(true);
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

  const updateAlertDetails = useCallback(
    async (
      id: string,
      details: {
        note: string;
        community: string;
        location?: AlertRecord['location'];
        photo?: string;
      },
    ) => {
      await saveAlertDetails(id, details);
      await refresh();
      notifyQueueChanged();
      if (isEffectivelyOnline()) {
        await runSync(true);
        await refresh();
      }
    },
    [refresh],
  );

  const createBiodiversityReport = useCallback(
    async (draft: BiodiversityReportDraft) => {
      const report = await createLocalBiodiversityReport(draft);
      await refresh();
      notifyQueueChanged();
      void requestBackgroundSync();
      if (isEffectivelyOnline()) {
        setSyncing(true);
        try {
          await runSync(true);
          await refresh();
        } finally {
          setSyncing(false);
        }
      }
      const current = await getAllBiodiversityReports();
      return current.find((item) => item.id === report.id) ?? report;
    },
    [refresh],
  );

  const cancelAlert = useCallback(
    async (id: string) => {
      try {
        const canceled = await cancelLocalAlert(id);
        await refresh();
        notifyQueueChanged();
        if (!canceled) {
          showToast(message('sync.laAlertaYaSalioDelTelefono'), 'warn');
          return false;
        }
        showToast(message('sync.alertaAnuladaNoSeEnviara'), 'ok');
        return true;
      } catch {
        showToast(message('sync.noSePudoAnularLaAlerta'), 'error');
        return false;
      }
    },
    [refresh, showToast],
  );

  const updateSettings = useCallback((patch: Partial<Omit<Settings, 'language'>>) => {
    setSettings((current) => {
      // Usa el idioma guardado más reciente al modificar otros ajustes.
      const next = { ...current, ...patch, language: loadSettings().language };
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
    await Promise.all([clearAlerts(), clearBiodiversityReports()]);
    await refresh();
    showToast(message('sync.seBorraronLosDatosLocales'), 'ok');
  }, [refresh, showToast]);

  const activeCount = alerts.filter((alert) => {
    if (alert.state === 'pending' || alert.state === 'sent') return true;
    if (alert.state !== 'received' || !alert.acknowledgedAt) return false;
    if (alert.responses?.length) return false;
    const acked = Date.parse(alert.acknowledgedAt);
    return !Number.isNaN(acked) && Date.now() - acked < 10 * 60_000;
  }).length;

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Pide al navegador que no borre la cola por falta de espacio. En Android de
  // gama baja el almacenamiento puede estar muy ajustado.
  useEffect(() => {
    const storage = navigator.storage;
    if (!storage?.persist || !storage.persisted) return;
    void storage
      .persisted()
      .then((already) => (already ? true : storage.persist()))
      .catch(() => false);
  }, []);

  useEffect(() => {
    const update = () => {
      const next = navigator.onLine;
      setRealOnline(next);
      if (next) {
        // Al volver la señal no esperamos la pausa progresiva.
        void syncNow(true);
      }
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [syncNow]);

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
        // Aunque el efecto se haya reiniciado, hay que liberar el candado:
        // si no, la app deja de reintentar y el botón queda deshabilitado.
        syncingRef.current = false;
        setSyncing(false);
      }
    };

    void tick();
    // Con alertas pendientes se reintenta seguido; sin pendientes basta una
    // consulta lenta para detectar confirmaciones de la red de salud.
    const intervalMs = activeCount > 0 ? 20_000 : 120_000;
    const interval = window.setInterval(() => void tick(), intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [online, refresh, activeCount]);

  const value = useMemo<AppContextValue>(
    () => ({
      alerts,
      biodiversityReports,
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
      updateAlertDetails,
      createBiodiversityReport,
      cancelAlert,
      syncNow,
      updateSettings,
      markSms,
      clearLocal,
    }),
    [
      alerts,
      biodiversityReports,
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
      updateAlertDetails,
      createBiodiversityReport,
      cancelAlert,
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
