// Resuelve los textos del idioma elegido y aplica el respaldo en español cuando corresponde.

import agr from '../locales/agr.json';
import cbt from '../locales/cbt.json';
import cni from '../locales/cni.json';
import es from '../locales/es.json';
import proposals from '../locales/propuestas.json';

export const LANGUAGES = [
  { id: 'es', label: 'Español' },
  { id: 'agr', label: 'Awajún' },
  { id: 'cbt', label: 'Shawi' },
  { id: 'cni', label: 'Asháninka' },
] as const;

export type Language = (typeof LANGUAGES)[number]['id'];
export type MessageKey = keyof typeof es;
export type VisualCatalog = Record<Exclude<Language, 'es'>, Partial<Record<MessageKey, string>>>;
type Values = Record<string, string | number>;
export type Translate = (key: MessageKey, values?: Values) => string;

export interface Message {
  key: MessageKey;
  values?: Values;
}

// Las traducciones documentadas tienen prioridad sobre las propuestas.
const catalogs: Record<Language, Partial<Record<MessageKey, string>>> = {
  es,
  agr: { ...proposals.agr, ...agr },
  cbt: { ...proposals.cbt, ...cbt },
  cni: { ...proposals.cni, ...cni },
};
const baseKeys = Object.keys(es) as MessageKey[];

export function isLanguageComplete(language: Language): boolean {
  return baseKeys.every((key) => messageLanguage(language, key) === language);
}

// Admite los códigos guardados por versiones anteriores de la app.
export function normalizeLanguage(value: unknown): Language {
  if (value === 'aw') return 'agr';
  if (value === 'sh') return 'cbt';
  return LANGUAGES.find(({ id }) => id === value)?.id ?? 'es';
}

export function message(key: MessageKey, values?: Values): Message {
  return { key, values };
}

export function messageLanguage(language: Language, key: MessageKey): Language {
  const catalog = catalogs[language];
  return Object.hasOwn(catalog, key) && catalog[key]?.trim() ? language : 'es';
}

// Usa la muestra de la beta si falta una traducción y sustituye las variables del mensaje.
export function translate(language: Language, key: MessageKey, values?: Values, visual?: VisualCatalog): string {
  const source = messageLanguage(language, key);
  const simulation = language !== 'es' && source === 'es' ? visual?.[language][key] : undefined;
  const template = simulation ?? catalogs[source][key] ?? es[key];
  return typeof template === 'string'
    ? template.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ''))
    : '';
}

// Conserva la clave del aviso para que la pantalla lo traduzca al mostrarlo.
export class InterfaceError extends Error {
  constructor(readonly key: MessageKey) {
    super(translate('es', key));
  }
}
