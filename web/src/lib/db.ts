// Android guarda la cola en SQLite nativo. La PWA conserva IndexedDB y su
// service worker, que no tienen acceso a los plugins nativos de Capacitor.
import { Capacitor } from '@capacitor/core';
import * as web from './db-web';
import type { AlertRecord, BiodiversityReport } from './types';

export { openDb } from './db-web';

const native = () => Capacitor.isNativePlatform();
const nativeDb = () => import('./db-native');

export async function getAllAlerts(): Promise<AlertRecord[]> {
  return native() ? (await nativeDb()).getAllAlerts() : web.getAllAlerts();
}

export async function getAlert(id: string): Promise<AlertRecord | undefined> {
  return native() ? (await nativeDb()).getAlert(id) : web.getAlert(id);
}

export async function putAlert(alert: AlertRecord): Promise<void> {
  return native() ? (await nativeDb()).putAlert(alert) : web.putAlert(alert);
}

export async function deleteAlert(id: string): Promise<void> {
  return native() ? (await nativeDb()).deleteAlert(id) : web.deleteAlert(id);
}

export async function clearAlerts(): Promise<void> {
  return native() ? (await nativeDb()).clearAlerts() : web.clearAlerts();
}

export async function getAllBiodiversityReports(): Promise<BiodiversityReport[]> {
  return native() ? (await nativeDb()).getAllBiodiversityReports() : web.getAllBiodiversityReports();
}

export async function getBiodiversityReport(id: string): Promise<BiodiversityReport | undefined> {
  return native() ? (await nativeDb()).getBiodiversityReport(id) : web.getBiodiversityReport(id);
}

export async function putBiodiversityReport(report: BiodiversityReport): Promise<void> {
  return native() ? (await nativeDb()).putBiodiversityReport(report) : web.putBiodiversityReport(report);
}

export async function clearBiodiversityReports(): Promise<void> {
  return native() ? (await nativeDb()).clearBiodiversityReports() : web.clearBiodiversityReports();
}
