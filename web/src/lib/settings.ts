// Guarda las preferencias locales y normaliza los códigos de idioma de versiones anteriores.

import { normalizeLanguage, type Language } from '../i18n/catalog';

export interface Settings {
  language: Language;
  community: string;
  deviceName: string;
  healthPost: string;
  healthPhone: string;
  smsNumber: string;
  simulateOffline: boolean;
}

const KEY = 'manguare.settings.v1';

const DEFAULT_SMS = (import.meta.env?.VITE_SMS_NUMBER as string | undefined) ?? '+51999999999';

export const DEFAULT_SETTINGS: Settings = {
  language: 'es',
  community: '',
  deviceName: 'Celular de la comunidad',
  healthPost: '',
  healthPhone: '',
  smsNumber: DEFAULT_SMS,
  simulateOffline: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      language: normalizeLanguage(parsed.language),
      community:
        typeof parsed.community === 'string' ? parsed.community : DEFAULT_SETTINGS.community,
      deviceName:
        typeof parsed.deviceName === 'string' && parsed.deviceName.trim()
          ? parsed.deviceName
          : DEFAULT_SETTINGS.deviceName,
      healthPost:
        typeof parsed.healthPost === 'string' ? parsed.healthPost : DEFAULT_SETTINGS.healthPost,
      healthPhone:
        typeof parsed.healthPhone === 'string' ? parsed.healthPhone : DEFAULT_SETTINGS.healthPhone,
      smsNumber:
        typeof parsed.smsNumber === 'string' ? parsed.smsNumber : DEFAULT_SETTINGS.smsNumber,
      simulateOffline:
        typeof parsed.simulateOffline === 'boolean'
          ? parsed.simulateOffline
          : DEFAULT_SETTINGS.simulateOffline,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Almacenamiento no disponible: la sesión sigue funcionando en memoria.
  }
}
