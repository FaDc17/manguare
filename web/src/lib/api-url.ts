import { Capacitor } from '@capacitor/core';

const STORAGE_KEY = 'manguare.nativeApiBase';
const localMvpBuild = import.meta.env?.VITE_LOCAL_MVP === '1';
const compiledApiBase = import.meta.env?.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? '';

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const numbers = parts.map(Number);
  if (numbers.some((part) => part > 255)) return false;
  return numbers[0] === 10 ||
    (numbers[0] === 172 && numbers[1] >= 16 && numbers[1] <= 31) ||
    (numbers[0] === 192 && numbers[1] === 168);
}

export function getNativeApiBase(): string {
  if (!Capacitor.isNativePlatform()) return '';
  return compiledApiBase || localStorage.getItem(STORAGE_KEY) || '';
}

export function normalizeNativeApiBase(value: string, allowLocalHttp = localMvpBuild): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (trimmed) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error('Usa la URL del servidor, sin rutas adicionales.');
    }
    if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname.toLowerCase())) {
      throw new Error('En el APK, localhost es el teléfono. Usa la IP privada del PC.');
    }
    const localHttp = allowLocalHttp && parsed.protocol === 'http:' && isPrivateIpv4(parsed.hostname);
    if (!(parsed.protocol === 'https:' || localHttp) || !parsed.hostname || parsed.pathname !== '/' ||
        parsed.search || parsed.hash || parsed.username || parsed.password) {
      throw new Error(allowLocalHttp
        ? 'Usa http://IP-PRIVADA-DEL-PC:8787 o una URL HTTPS, sin rutas adicionales.'
        : 'Usa la URL HTTPS del servidor, sin rutas adicionales.');
    }
  }
  return trimmed;
}

export function setNativeApiBase(value: string): string {
  const trimmed = normalizeNativeApiBase(value);
  if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
  else localStorage.removeItem(STORAGE_KEY);
  return trimmed;
}

/** La PWA conserva rutas relativas; Android usa la URL integrada en el APK. */
export function apiUrl(path: `/api${string}`): string {
  if (!Capacitor.isNativePlatform()) return path;
  const base = normalizeNativeApiBase(getNativeApiBase());
  if (!base) throw new Error('No está disponible la configuración interna del servidor de Manguaré.');
  return `${base}${path}`;
}
