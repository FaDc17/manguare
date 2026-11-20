// Relaciona los códigos de categorías y respuestas con las claves de traducción.

import type { AlertResponse, BiodiversityCategory } from '../lib/types';
import type { MessageKey, Translate } from './catalog';

export const biodiversityLabels = {
  'Tala ilegal': 'biodiversity.category.logging',
  'Caza o pesca ilegal': 'biodiversity.category.huntingFishing',
  'Contaminación de ríos': 'biodiversity.category.pollution',
  'Minería ilegal': 'biodiversity.category.mining',
  Incendios: 'biodiversity.category.fires',
  Otro: 'emergency.otro',
} as const satisfies Record<BiodiversityCategory, MessageKey>;

const communityLabels: Partial<Record<string, MessageKey>> = {
  transporte: 'community.category.transporte',
  vestimenta: 'community.category.vestimenta',
  hogar: 'community.category.hogar',
  alimentos: 'community.category.alimentos',
  otros: 'community.category.otros',
};

export function communityLabel(id: string, fallback: MessageKey = 'common.community'): MessageKey {
  return Object.hasOwn(communityLabels, id) ? communityLabels[id] ?? fallback : fallback;
}

const responseLabels: Partial<Record<string, MessageKey>> = {
  en_camino: 'response.en_camino',
  acudir_posta: 'response.acudir_posta',
  sin_medico: 'response.sin_medico',
  otra: 'response.otra',
};

export function responseLabel(code: string): MessageKey {
  return Object.hasOwn(responseLabels, code) ? responseLabels[code] ?? 'response.unknown' : 'response.unknown';
}

export function translatedResponse(t: Translate, response: AlertResponse): string {
  return response.message || t(responseLabel(response.code));
}
