import type { SessionRole } from './session';

export interface AgentCapability {
  id: string;
  screen: string;
  description: string;
  dataSource: string;
  readTools: string[];
  actionTools: string[];
  dataScope: 'device' | 'shared' | 'demo' | 'panel';
  requiresNetwork?: boolean;
  adminOnly?: boolean;
  browserPanelOnly?: boolean;
}

/** Registro de módulos expuestos al agente. Añadir un módulo requiere registrar
 * sus herramientas y su implementación; no se ejecuta código por descubrirlo. */
export const AGENT_CAPABILITIES: readonly AgentCapability[] = [
  { id: 'inicio', screen: 'home', description: 'Estado de conexión, acceso y resumen de alertas.',
    dataSource: 'AppContext y SessionContext', readTools: ['get_app_context', 'get_app_capabilities', 'read_current_screen'],
    actionTools: ['navigate_to_screen'], dataScope: 'device' },
  { id: 'emergencias', screen: 'history', description: 'Tipos de emergencia y alertas guardadas en este teléfono.',
    dataSource: 'IndexedDB y tipos de emergencia', readTools: ['get_emergency_options', 'get_my_alerts'],
    actionTools: ['navigate_to_screen'], dataScope: 'device' },
  { id: 'biodiversidad', screen: 'biodiversity', description: 'Categorías ambientales y reportes de este teléfono.',
    dataSource: 'IndexedDB y categorías ambientales', readTools: ['get_environment_topics', 'get_environment_reports'],
    actionTools: ['navigate_to_screen'], dataScope: 'device' },
  { id: 'comunidad', screen: 'community', description: 'Mercado, categorías, productos y servicios.',
    dataSource: 'almacenamiento local, API social y catálogo de demostración',
    readTools: ['get_community_catalog', 'search_listings', 'open_listing', 'get_listing_form_schema',
      'get_listing_form_values', 'validate_listing_form'],
    actionTools: ['open_listing_form', 'update_listing_form_fields', 'use_current_location',
      'request_listing_publication_confirmation', 'publish_listing', 'cancel_listing_publication'],
    dataScope: 'shared' },
  { id: 'red', screen: 'network', description: 'Muro compartido y perfiles Match de demostración.',
    dataSource: 'almacenamiento local, API social y perfiles de demostración',
    readTools: ['search_wall_posts', 'get_match_profiles'], actionTools: ['navigate_to_screen'], dataScope: 'shared' },
  { id: 'mapa', screen: 'map', description: 'Marcadores y filtros del mapa; los puntos incluidos son de demostración.',
    dataSource: 'los mismos marcadores que dibuja MapScreen',
    readTools: ['get_map_places', 'get_device_location'], actionTools: ['navigate_to_screen', 'open_map_place'],
    dataScope: 'demo' },
  { id: 'idiomas', screen: 'settings', description: 'Idioma activo y traducciones disponibles.',
    dataSource: 'LanguageContext y catálogos', readTools: ['get_language_options'],
    actionTools: ['set_app_language'], dataScope: 'device' },
  { id: 'ajustes', screen: 'settings', description: 'Perfil local y preferencias de este dispositivo.',
    dataSource: 'SessionContext y AppContext', readTools: ['get_profile_and_settings'],
    actionTools: ['update_profile_name', 'update_app_setting'], dataScope: 'device' },
  { id: 'ayuda', screen: 'home', description: 'Contactos de ayuda configurados y números mostrados en la app.',
    dataSource: 'preferencias locales y HelpSheet', readTools: ['get_help_contacts'],
    actionTools: ['navigate_to_screen'], dataScope: 'device' },
  { id: 'panel', screen: 'settings', description: 'Emergencias de la red de salud.',
    dataSource: 'API del panel con sesión autenticada', readTools: ['get_admin_pending_emergencies'],
    actionTools: [], dataScope: 'panel', requiresNetwork: true, adminOnly: true, browserPanelOnly: true },
];

export function listAgentCapabilities(role: SessionRole, native: boolean, online: boolean) {
  return AGENT_CAPABILITIES.map((module) => {
    const disabled = module.id === 'biodiversidad' || module.id === 'comunidad' || module.id === 'red';
    const available = !disabled && (!module.adminOnly || role === 'admin') &&
      (!module.browserPanelOnly || !native) && (!module.requiresNetwork || online);
    const reason = disabled
      ? 'Acceso inhabilitado por el momento para futuras mejoras'
      : module.adminOnly && role !== 'admin'
      ? 'Requiere el rol administrador.'
      : module.browserPanelOnly && native
        ? 'El panel usa una sesión web separada en Android.'
        : module.requiresNetwork && !online
          ? 'Requiere conexión.'
          : undefined;
    return { ...module, available, ...(reason ? { reason } : {}) };
  });
}
