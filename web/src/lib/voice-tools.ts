import { COMMUNITY_CATEGORIES, type CommunityListing } from './community';
import type { SessionRole } from './session';

export interface ListingFormValues {
  title: string;
  category: string;
  price: string;
  location: string;
  description: string;
  photoAttached?: boolean;
  coordinates?: { lat: number; lng: number; accuracy: number };
}

export type ListingFormPatch = Partial<
  Pick<ListingFormValues, 'title' | 'category' | 'price' | 'location' | 'description'>
>;

export interface ListingValidation {
  valid: boolean;
  missing: Array<keyof Pick<ListingFormValues, 'title' | 'category' | 'price' | 'location' | 'description'>>;
}

export interface ListingFormController {
  getValues(): ListingFormValues;
  getPublicationSnapshot(): string;
  resetForVoice(): void;
  updateFields(patch: ListingFormPatch): { success: boolean; message: string; values: ListingFormValues };
  setCoordinates(coordinates: ListingFormValues['coordinates']): void;
  validateForVoice(): ListingValidation;
  publish(): { success: boolean; message: string };
}

export interface CommunityVoiceController {
  showHome(): void;
  openListingForm(): void;
  getListingForm(): ListingFormController | null;
  searchListings(query: string, near?: { lat: number; lng: number } | null, community?: string): CommunityListing[];
  openListing(id: string): boolean;
}

export function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function listingDistanceKm(listing: CommunityListing, point: { lat: number; lng: number }): number | null {
  if (!listing.coordinates) return null;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = toRadians(listing.coordinates.lat - point.lat);
  const dLng = toRadians(listing.coordinates.lng - point.lng);
  const arc = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(point.lat)) *
    Math.cos(toRadians(listing.coordinates.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

export function searchCommunityListings(
  listings: CommunityListing[],
  query: string,
  near?: { lat: number; lng: number } | null,
  community?: string,
): CommunityListing[] {
  const ignored = new Set(['hay', 'alguien', 'vende', 'vendiendo', 'venta', 'compro', 'comprar',
    'busco', 'buscando', 'necesito', 'quiero', 'un', 'una', 'unos', 'unas', 'de', 'del',
    'la', 'el', 'los', 'las', 'cerca', 'mi', 'aqui', 'por', 'favor', 'en', 'que', 'quien',
    'ofrece', 'ofreciendo', 'producto', 'productos', 'servicio', 'servicios', 'para']);
  const terms = normalizeSearch(query).split(/\s+/).filter((term) => term && !ignored.has(term));
  if (terms.length === 0) return [];
  const local = normalizeSearch(community ?? '');
  return listings.filter((listing) => {
    const haystack = normalizeSearch([
      listing.title, listing.description, listing.category, listing.location,
      listing.community, listing.district, listing.province, listing.department,
    ].join(' '));
    if (!terms.every((term) => haystack.includes(term))) return false;
    if (near) {
      const distance = listingDistanceKm(listing, near);
      return distance !== null && distance <= 30;
    }
    return !local || normalizeSearch([listing.community, listing.location, listing.district].join(' ')).includes(local);
  }).sort((left, right) => near
    ? (listingDistanceKm(left, near) ?? Infinity) - (listingDistanceKm(right, near) ?? Infinity)
    : 0);
}

export function voiceCapabilities(role: SessionRole): string[] {
  return [
    'navegar', 'leer_pantalla_actual', 'buscar_publicaciones', 'ver_publicacion', 'leer_muro',
    'consultar_mis_alertas', 'consultar_reportes_ambientales',
    'leer_perfil_y_ajustes', 'editar_nombre_y_ajustes', 'crear_publicacion',
    ...(role === 'admin' ? ['consultar_emergencias_del_panel_con_sesion_autenticada'] : []),
  ];
}

export function canReadAdminEmergencies(role: SessionRole, panelAuthenticated: boolean): boolean {
  return role === 'admin' && panelAuthenticated;
}

export interface VoiceToolResult {
  success: boolean;
  message: string;
  [key: string]: unknown;
}

export interface VoiceToolContext {
  signal: AbortSignal;
  lastUserUtterance: string;
}

export type VoiceToolHandler = (
  name: string,
  args: Record<string, unknown>,
  context: VoiceToolContext,
) => Promise<unknown> | unknown;

export const VOICE_FUNCTION_DECLARATIONS = [
  {
    name: 'get_app_context',
    description: 'Obtiene el rol real, pantalla actual y funciones disponibles de esta sesión.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'read_current_screen',
    description: 'Lee el texto realmente visible de la pantalla actual de Manguaré para responder dudas sobre la app. Para otra pantalla, navega primero.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'search_listings',
    description: 'Busca productos y servicios reales en Comunidad, abre los resultados en pantalla. nearMe usa GPS; si falla, usa la comunidad del perfil cuando exista.',
    parameters: { type: 'OBJECT', properties: {
      query: { type: 'STRING' }, nearMe: { type: 'BOOLEAN' }, location: { type: 'STRING' },
    }, required: ['query'] },
  },
  {
    name: 'open_listing',
    description: 'Abre en vivo el detalle de una publicación obtenida de search_listings.',
    parameters: { type: 'OBJECT', properties: { listingId: { type: 'STRING' } }, required: ['listingId'] },
  },
  {
    name: 'search_wall_posts',
    description: 'Lee publicaciones del muro de la Red Comunitaria por texto; abre la pestaña Muro.',
    parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } } },
  },
  {
    name: 'get_my_alerts',
    description: 'Consulta alertas de emergencia guardadas en este teléfono y abre Historial. No son emergencias de todo el panel.',
    parameters: { type: 'OBJECT', properties: { state: { type: 'STRING', enum: ['all', 'pending', 'sent', 'received', 'canceled'] } } },
  },
  {
    name: 'get_environment_reports',
    description: 'Consulta reportes ambientales guardados en este teléfono y abre Historial.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_profile_and_settings',
    description: 'Abre Ajustes y lee el nombre del perfil y preferencias visibles de esta cuenta.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'update_profile_name',
    description: 'Cambia el nombre del perfil en Ajustes, solo tras preguntar y obtener el nombre exacto del usuario.',
    parameters: { type: 'OBJECT', properties: { name: { type: 'STRING' } }, required: ['name'] },
  },
  {
    name: 'update_app_setting',
    description: 'Edita un campo visible de Ajustes indicado expresamente por el usuario.',
    parameters: { type: 'OBJECT', properties: {
      field: { type: 'STRING', enum: ['community', 'deviceName', 'healthPost', 'healthPhone', 'smsNumber'] },
      value: { type: 'STRING' },
    }, required: ['field', 'value'] },
  },
  {
    name: 'get_admin_pending_emergencies',
    description: 'Solo para rol admin y sesión autenticada en el panel de salud: lee emergencias del servidor pendientes de revisión.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'navigate_to_screen',
    description: 'Navega a una pantalla real de Manguaré y devuelve el resultado verificado.',
    parameters: {
      type: 'OBJECT',
      properties: {
        screen: {
          type: 'STRING',
          enum: ['home', 'community', 'network', 'map', 'biodiversity', 'history', 'settings', 'new', 'alert'],
        },
        tab: { type: 'STRING', enum: ['wall', 'match', 'agent'] },
        alertId: { type: 'STRING' },
      },
      required: ['screen'],
    },
  },
  {
    name: 'open_listing_form',
    description: 'Abre Comunidad y el formulario real para publicar un producto o servicio.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_listing_form_schema',
    description: 'Consulta las etiquetas, los límites, categorías y campos requeridos del formulario real.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_listing_form_values',
    description: 'Lee los valores actuales del formulario real y los campos de voz aún requeridos.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'update_listing_form_fields',
    description: 'Actualiza únicamente los campos indicados del formulario real de publicación.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        category: {
          type: 'STRING',
          enum: COMMUNITY_CATEGORIES.map((category) => category.id),
        },
        price: { type: 'STRING' },
        location: { type: 'STRING' },
        description: { type: 'STRING' },
      },
    },
  },
  {
    name: 'validate_listing_form',
    description: 'Valida los datos capturados antes de pedir autorización para publicar.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'use_current_location',
    description: 'Solicita permiso y obtiene coordenadas reales del dispositivo, luego las guarda en Ubicación.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'request_listing_publication_confirmation',
    description: 'Genera un resumen fiel y una confirmación pendiente. No publica.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'publish_listing',
    description: 'Publica mediante el mecanismo real solo después de una confirmación verbal explícita del usuario.',
    parameters: {
      type: 'OBJECT',
      properties: { confirmationId: { type: 'STRING' } },
      required: ['confirmationId'],
    },
  },
  {
    name: 'cancel_listing_publication',
    description: 'Cancela la confirmación pendiente; no publica ni cambia de pantalla.',
    parameters: { type: 'OBJECT', properties: {} },
  },
];

const VOICE_REQUIRED_FIELDS = [
  ['title', 'título'],
  ['category', 'categoría'],
  ['price', 'precio'],
  ['location', 'ubicación'],
  ['description', 'descripción'],
] as const;

export function validateVoiceListing(values: ListingFormValues): ListingValidation {
  const missing = VOICE_REQUIRED_FIELDS
    .filter(([field]) => !values[field].trim())
    .map(([field]) => field);
  return { valid: missing.length === 0, missing: [...missing] };
}

export function voiceListingFieldSchema() {
  return {
    title: { label: 'Título', required: true, maxLength: 80 },
    category: {
      label: 'Categoría',
      required: true,
      options: COMMUNITY_CATEGORIES.map(({ id, label }) => ({ id, label })),
    },
    price: { label: 'Precio', required: true, maxLength: 30 },
    location: {
      label: '¿Dónde te encuentran?',
      required: true,
      maxLength: 80,
      acceptsGpsCoordinates: true,
    },
    description: { label: 'Descripción', required: true, maxLength: 400 },
    photo: { label: 'Foto', required: false },
  };
}

export function isExplicitPublicationConfirmation(utterance: string): boolean {
  const normalized = utterance
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!,.;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    !normalized ||
    /\b(no|cancela|cancelar|espera|todavia|cambio|cambiar|pero|quizas|tal vez|duda)\b/.test(
      normalized,
    )
  ) {
    return false;
  }

  return /^(si|claro|confirmo|autorizo|adelante|hazlo|publica|publicalo|publicala|de acuerdo)( [a-z0-9ñ]+){0,6}$/.test(
    normalized,
  );
}

export function summarizeVoiceListing(values: ListingFormValues): string {
  const category =
    COMMUNITY_CATEGORIES.find((option) => option.id === values.category)?.label ?? values.category;
  const gps = values.coordinates
    ? `Coordenadas GPS exactas: ${values.coordinates.lat}, ${values.coordinates.lng} (precisión aproximada ${values.coordinates.accuracy} m).`
    : 'Sin coordenadas GPS.';
  return [
    `Título: ${values.title.trim()}.`,
    `Categoría: ${category}.`,
    `Precio: ${values.price.trim()}.`,
    `Ubicación: ${values.location.trim()}.`,
    `Descripción: ${values.description.trim()}.`,
    gps,
  ].join(' ');
}
