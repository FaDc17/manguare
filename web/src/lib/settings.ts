export type Language = 'es' | 'aw' | 'sh';

export interface Settings {
  language: Language;
  community: string;
  deviceName: string;
  smsNumber: string;
  simulateOffline: boolean;
}

export const LANGUAGES: Array<{
  id: Language;
  label: string;
  native: string;
  status: 'listo' | 'pendiente';
  note: string;
}> = [
  {
    id: 'es',
    label: 'Español',
    native: 'Castellano',
    status: 'listo',
    note: 'Interfaz y audio de demostración disponibles.',
  },
  {
    id: 'aw',
    label: 'Awajún',
    native: 'Awajún',
    status: 'pendiente',
    note: 'Traducción y audio pendientes de grabación con hablantes de la comunidad.',
  },
  {
    id: 'sh',
    label: 'Shawi',
    native: 'Shawi',
    status: 'pendiente',
    note: 'Traducción y audio pendientes de grabación con hablantes de la comunidad.',
  },
];

const KEY = 'manguare.settings.v1';

const DEFAULT_SMS = (import.meta.env.VITE_SMS_NUMBER as string | undefined) ?? '+51999999999';

export const DEFAULT_SETTINGS: Settings = {
  language: 'es',
  community: '',
  deviceName: 'Celular de la comunidad',
  smsNumber: DEFAULT_SMS,
  simulateOffline: false,
};

function isLanguage(value: unknown): value is Language {
  return value === 'es' || value === 'aw' || value === 'sh';
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      language: isLanguage(parsed.language) ? parsed.language : DEFAULT_SETTINGS.language,
      community:
        typeof parsed.community === 'string' ? parsed.community : DEFAULT_SETTINGS.community,
      deviceName:
        typeof parsed.deviceName === 'string' && parsed.deviceName.trim()
          ? parsed.deviceName
          : DEFAULT_SETTINGS.deviceName,
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
