import { Capacitor } from '@capacitor/core';
import { translate } from '../i18n/catalog';
import { getAllAlerts } from './db';
import { loadSettings } from './settings';
import {
  markAlertNotice,
  noticeSnapshot,
  pendingAlertNotices,
  type AlertNotice,
  type AlertNoticeSeen,
} from './alert-notification-state';
import type { AlertRecord } from './types';

const KEY = 'manguare.alert-notifications.v1';

interface NoticeState {
  enabledAt: number;
  seen: Record<string, AlertNoticeSeen>;
}

function readState(): NoticeState | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as NoticeState | null;
    return parsed && Number.isFinite(parsed.enabledAt) && parsed.seen ? parsed : null;
  } catch {
    return null;
  }
}

function writeState(state: NoticeState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function alertNotificationsEnabled(): boolean {
  return readState() !== null;
}

export async function alertNotificationPermission(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      return (await LocalNotifications.checkPermissions()).display === 'granted';
    }
    return typeof Notification !== 'undefined' && 'serviceWorker' in navigator &&
      Notification.permission === 'granted';
  } catch {
    return false;
  }
}

async function requestPermission(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      return (await LocalNotifications.requestPermissions()).display === 'granted';
    }
    return typeof Notification !== 'undefined' && 'serviceWorker' in navigator &&
      (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

function numericId(value: string): number {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % 2147483647 || 1;
}

async function deliver(notice: AlertNotice): Promise<boolean> {
  const t = (key: 'notifications.sentTitle' | 'notifications.sentBody' |
    'notifications.responseTitle' | 'notifications.responseBody') =>
    translate(loadSettings().language, key);
  const title = notice.kind === 'sent' ? t('notifications.sentTitle') : t('notifications.responseTitle');
  const body = notice.kind === 'sent' ? t('notifications.sentBody') : t('notifications.responseBody');
  const tag = `manguare-${notice.kind}-${notice.alertId}`;
  try {
    if (Capacitor.isNativePlatform()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.schedule({ notifications: [{
        id: numericId(tag), title, body, extra: { alertId: notice.alertId },
        foreground: true, isExactNotification: false,
      }] });
      return true;
    }
    const registration = await navigator.serviceWorker?.getRegistration();
    if (!registration?.active) return false;
    await registration.showNotification(title, {
      body, icon: '/icons/icon-192.png', tag, data: { alertId: notice.alertId },
    });
    return true;
  } catch {
    return false;
  }
}

export async function enableAlertNotifications(currentAlerts: AlertRecord[]): Promise<boolean> {
  const enabledAt = Date.now();
  if (!(await requestPermission())) return false;
  if (!readState()) {
    const seen = Object.fromEntries(currentAlerts.map((alert) => [alert.id, noticeSnapshot(alert)]));
    try {
      writeState({ enabledAt, seen });
    } catch {
      return false;
    }
  }
  void processAlertNotifications();
  return true;
}

let processChain: Promise<void> = Promise.resolve();

export function processAlertNotifications(): Promise<void> {
  processChain = processChain.catch(() => {}).then(async () => {
    const state = readState();
    if (!state || !(await alertNotificationPermission())) return;
    const alerts = await getAllAlerts();
    const seen: Record<string, AlertNoticeSeen> = {};
    for (const alert of alerts) {
      const createdAt = Date.parse(alert.createdAt);
      let current = state.seen[alert.id] ??
        (!Number.isNaN(createdAt) && createdAt >= state.enabledAt ? {} : noticeSnapshot(alert));
      for (const notice of pendingAlertNotices(alert, current)) {
        if (await deliver(notice)) current = markAlertNotice(current, notice);
      }
      seen[alert.id] = current;
    }
    writeState({ ...state, seen });
  });
  return processChain;
}
