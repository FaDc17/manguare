// Organiza las pantallas y vincula el selector de idioma con los avisos y diálogos de la app.

import { Capacitor } from '@capacitor/core';
import { useTranslation } from './i18n/LanguageContext';
import { LANGUAGES, isLanguageComplete, type Language } from './i18n/catalog';
import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { AppProvider, useApp } from './app/AppContext';
import { SessionProvider, useSession } from './app/SessionContext';
import { BottomNav, type Tab } from './components/BottomNav';
import { HelpSheet } from './components/HelpSheet';
import { LanguageSheet } from './components/LanguageSheet';
import { Sheet } from './components/Sheet';
import { Toast } from './components/Toast';
import { TopBar } from './components/TopBar';
import { clearSession, loadSession, saveProfileName, saveSession, type Session } from './lib/session';
import { EMERGENCY_META } from './lib/emergency';
import { BIODIVERSITY_CATEGORIES, EMERGENCY_TYPES, type BiodiversityCategory, type ServerAlert } from './lib/types';
import { AlertDetailScreen } from './screens/AlertDetailScreen';
import { BiodiversityReportScreen } from './screens/BiodiversityReportScreen';
import { CommunityScreen } from './screens/CommunityScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { NetworkScreen } from './screens/NetworkScreen';
import { NewAlertScreen } from './screens/NewAlertScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { isEffectivelyOnline } from './lib/sync';
import { apiUrl } from './lib/api-url';
import { VoiceAssistant } from './components/VoiceAssistant';
import { getCurrentLocation } from './lib/geography';
import { applySync, loadSocialState, MATCH_PROFILES, ROLE_LABEL } from './lib/social';
import { readRemotePosts } from './lib/social-sync';
import { COMMUNITY_CATEGORIES, ENVIRONMENT_TOPICS } from './lib/community';
import { HELP_CONTACTS } from './lib/help-contacts';
import { loadSettings } from './lib/settings';
import { listAgentCapabilities } from './lib/agent-capabilities';
import { placeDistanceKm, type MapVoiceController } from './lib/map-data';
import type { CommunityVoiceController } from './lib/voice-tools';
import {
  isExplicitPublicationConfirmation,
  hasExplicitLanguageIntent,
  hasExplicitLocationIntent,
  summarizeVoiceListing,
  validateVoiceListing,
  voiceListingFieldSchema,
  listingDistanceKm,
  normalizeSearch,
  canReadAdminEmergencies,
  type ListingFormPatch,
  type VoiceToolContext,
} from './lib/voice-tools';

const MapScreen = lazy(() =>
  import('./screens/MapScreen').then((module) => ({ default: module.MapScreen })),
);

const ACCESS_DISABLED_MESSAGE = 'Acceso inhabilitado por el momento para futuras mejoras';
const DISABLED_VOICE_TOOLS = new Set([
  'get_environment_topics', 'get_environment_reports',
  'get_community_catalog', 'search_listings', 'open_listing', 'search_wall_posts',
  'get_match_profiles', 'open_listing_form', 'get_listing_form_schema',
  'get_listing_form_values', 'update_listing_form_fields', 'validate_listing_form',
  'use_current_location', 'request_listing_publication_confirmation',
  'publish_listing', 'cancel_listing_publication',
]);

type Screen =
  | { name: 'home' }
  | { name: 'community' }
  | { name: 'network'; initialTab?: 'wall' | 'match' | 'agent'; initialSearch?: string }
  | { name: 'map' }
  | { name: 'biodiversity'; category?: BiodiversityCategory }
  | { name: 'history' }
  | { name: 'settings' }
  | { name: 'new'; sos?: boolean }
  | { name: 'alert'; id: string };

function AppShell() {
  const { t, language, setLanguage } = useTranslation();
  const [screen, setScreenState] = useState<Screen>({ name: 'home' });
  const [languageOpen, setLanguageOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sosConfirmOpen, setSosConfirmOpen] = useState(false);
  const { alerts, biodiversityReports, settings, updateSettings, showToast } = useApp();
  const setScreen = (target: Screen) => {
    if (target.name === 'community' || target.name === 'network' || target.name === 'biodiversity') {
      showToast(ACCESS_DISABLED_MESSAGE, 'warn');
      return;
    }
    setScreenState(target);
  };
  const { session, updateName } = useSession();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const communityVoiceControllerRef = useRef<CommunityVoiceController | null>(null);
  const mapVoiceControllerRef = useRef<MapVoiceController | null>(null);
  const pendingPublicationRef = useRef<{
    id: string;
    snapshot: string;
  } | null>(null);

  const openVoice = () => setVoiceOpen(true);
  const closeVoice = () => {
    pendingPublicationRef.current = null;
    setVoiceOpen(false);
  };

  const registerCommunityVoiceController = useCallback(
    (controller: CommunityVoiceController | null) => {
      communityVoiceControllerRef.current = controller;
    },
    [],
  );

  const registerMapVoiceController = useCallback((controller: MapVoiceController | null) => {
    mapVoiceControllerRef.current = controller;
  }, []);

  const waitFor = async (
    predicate: () => boolean,
    description: string,
    signal: AbortSignal,
  ) => {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      if (signal.aborted) throw new DOMException('La acción fue cancelada.', 'AbortError');
      if (predicate()) return;
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    }
    throw new Error(`No se pudo verificar que ${description}.`);
  };

  const navigateAndVerify = async (
    target: Screen,
    expectedName: Screen['name'],
    signal: AbortSignal,
  ) => {
    if (signal.aborted) throw new DOMException('La acción fue cancelada.', 'AbortError');
    if (target.name === 'community' || target.name === 'network' || target.name === 'biodiversity') {
      throw new Error(ACCESS_DISABLED_MESSAGE);
    }
    const previous = screenRef.current;
    setScreen(target);
    try {
      await waitFor(
        () => document.querySelector('[data-testid="app-screen"]')?.getAttribute('data-screen') === expectedName,
        `se abriera ${expectedName}`,
        signal,
      );
    } catch (error) {
      if (signal.aborted) setScreen(previous);
      throw error;
    }
  };

  const requireListingForm = async (signal: AbortSignal) => {
    await waitFor(
      () => {
        const input = document.querySelector('[data-testid="listing-title"]');
        return Boolean(
          communityVoiceControllerRef.current?.getListingForm() &&
          input &&
          (input as HTMLElement).getClientRects().length,
        );
      },
      'estuviera abierto el formulario de publicación',
      signal,
    );
    const controller = communityVoiceControllerRef.current?.getListingForm();
    if (!controller) throw new Error('El formulario de publicación no está montado.');
    return controller;
  };

  const handleVoiceToolCall = async (
    name: string,
    args: Record<string, unknown>,
    context: VoiceToolContext,
  ) => {
    const { signal, lastUserUtterance } = context;
    if (signal.aborted) throw new DOMException('La acción fue cancelada.', 'AbortError');
    if (DISABLED_VOICE_TOOLS.has(name) ||
        (name === 'navigate_to_screen' &&
          (args.screen === 'community' || args.screen === 'network' || args.screen === 'biodiversity'))) {
      return { success: false, message: ACCESS_DISABLED_MESSAGE };
    }

    if (name === 'get_app_context') {
      return {
        success: true, user: { name: session.name, role: session.role },
        screen: screenRef.current.name, language, online: isEffectivelyOnline(),
        localAlertCount: alerts.length, localEnvironmentReportCount: biodiversityReports.length,
        mapFilters: screenRef.current.name === 'map' ? mapVoiceControllerRef.current?.getSnapshot().filters : undefined,
        capabilities: listAgentCapabilities(session.role, Capacitor.isNativePlatform(), isEffectivelyOnline()),
        note: session.role === 'admin' && Capacitor.isNativePlatform()
          ? 'En Android, consulta las emergencias de la red en el panel web desde Ajustes; ese panel tiene su propia sesión.'
          : session.role === 'admin'
          ? 'Las emergencias de la red requieren además una sesión autenticada en el panel de salud.'
          : 'Las alertas del Historial pertenecen a este teléfono; las emergencias de la red solo están en el panel administrador.',
      };
    }

    if (name === 'get_app_capabilities') {
      return { success: true, modules: listAgentCapabilities(
        session.role, Capacitor.isNativePlatform(), isEffectivelyOnline(),
      ), note: 'Solo se pueden ejecutar las herramientas registradas; las fuentes demo no son registros verificados.' };
    }

    if (name === 'get_emergency_options') {
      return { success: true, types: EMERGENCY_TYPES.map((id) => ({
        id, label: EMERGENCY_META[id].label, hint: EMERGENCY_META[id].hint,
      })), localAlertCount: alerts.length,
      byState: Object.fromEntries(['pending', 'sent', 'received', 'canceled'].map((state) => [
        state, alerts.filter((item) => item.state === state).length,
      ])), scope: 'este teléfono' };
    }

    if (name === 'get_environment_topics') {
      return { success: true, categories: BIODIVERSITY_CATEGORIES,
        topics: ENVIRONMENT_TOPICS, localReportCount: biodiversityReports.length,
        scope: 'este teléfono' };
    }

    if (name === 'get_language_options') {
      return { success: true, active: language,
        languages: LANGUAGES.map((option) => ({ ...option, complete: isLanguageComplete(option.id) })),
        note: 'Los idiomas incompletos muestran texto de respaldo en español.' };
    }

    if (name === 'set_app_language') {
      const requested = args.language;
      const option = LANGUAGES.find((item) => item.id === requested);
      if (!option) return { success: false, message: 'Idioma no disponible.' };
      if (!hasExplicitLanguageIntent(lastUserUtterance))
        return { success: false, message: 'Necesito que pidas expresamente el cambio de idioma.' };
      setLanguage(option.id as Language);
      await waitFor(() => loadSettings().language === option.id && document.documentElement.lang ===
        (isLanguageComplete(option.id) ? option.id : 'es'), 'se aplicara el idioma', signal);
      return { success: true, language: option.id, label: option.label,
        complete: isLanguageComplete(option.id), verified: true };
    }

    if (name === 'get_help_contacts') {
      return { success: true, contacts: HELP_CONTACTS.map((item) => ({
        number: item.number, label: t(item.label), detail: t(item.detail),
      })), healthPost: settings.healthPost.trim(), healthPhone: settings.healthPhone.trim(),
      note: 'Los números telefónicos necesitan señal. Manguaré no reemplaza los servicios de emergencia.' };
    }

    if (name === 'get_match_profiles') {
      const query = typeof args.query === 'string' ? normalizeSearch(args.query.slice(0, 80)) : '';
      const role = typeof args.role === 'string' ? args.role : 'all';
      if (!['all', 'productor', 'comprador', 'voluntario'].includes(role))
        return { success: false, message: 'Rol de Match no reconocido.' };
      const state = loadSocialState();
      const profiles = MATCH_PROFILES.filter((item) =>
        (role === 'all' || item.role === role) &&
        (!query || normalizeSearch([item.name, item.community, item.headline, item.about, ...item.tags]
          .join(' ')).includes(query)));
      return { success: true, count: profiles.length, demo: true,
        profiles: profiles.map((item) => ({ id: item.id, name: item.name,
          role: ROLE_LABEL[item.role], community: item.community, headline: item.headline,
          tags: item.tags, matchedOnThisDevice: state.matches.includes(item.id) })) };
    }

    if (name === 'get_device_location') {
      if (!hasExplicitLocationIntent(lastUserUtterance))
        return { success: false, message: 'Solicita expresamente tu ubicación antes de activar el GPS.' };
      try {
        const point = await getCurrentLocation();
        if (signal.aborted) throw new DOMException('La acción fue cancelada.', 'AbortError');
        return { success: true, latitude: point.lat, longitude: point.lng,
          accuracyMeters: point.accuracy, source: 'GPS del dispositivo' };
      } catch (error) {
        if (signal.aborted) throw error;
        return { success: false, message: error instanceof Error ? error.message : 'No se pudo obtener el GPS.' };
      }
    }

    if (name === 'get_map_places' || name === 'open_map_place') {
      await navigateAndVerify({ name: 'map' }, 'map', signal);
      await waitFor(() => Boolean(mapVoiceControllerRef.current), 'se cargara el mapa', signal);
      if (name === 'open_map_place') {
        const id = typeof args.placeId === 'string' ? args.placeId : '';
        const controller = mapVoiceControllerRef.current;
        const place = controller?.getSnapshot().visiblePlaces.find((item) => item.id === id);
        if (!place || !controller?.selectPlace(id))
          return { success: false, message: 'Ese marcador no está visible con los filtros actuales.' };
        await waitFor(() => Boolean(document.querySelector('[data-testid="map-selected"]')?.textContent?.includes(place.name)),
          'se mostrara el marcador', signal);
        return { success: true, place: { id: place.id, name: place.name, demo: place.demo }, verified: true };
      }
      const query = typeof args.query === 'string' ? args.query.trim().slice(0, 80) : '';
      const kind = typeof args.kind === 'string' ? args.kind : 'all';
      if (!['all', 'emergency', 'support', 'conecta'].includes(kind))
        return { success: false, message: 'Filtro de mapa no reconocido.' };
      let point: { lat: number; lng: number } | null = null;
      if (args.nearMe === true) {
        if (!hasExplicitLocationIntent(lastUserUtterance))
          return { success: false, message: 'Solicita expresamente una búsqueda cercana antes de activar el GPS.' };
        try {
          point = await getCurrentLocation();
        } catch (error) {
          return { success: false, message: error instanceof Error ? error.message : 'No se pudo obtener el GPS.' };
        }
      }
      const controller = mapVoiceControllerRef.current;
      if (!controller) throw new Error('No se pudo consultar el mapa.');
      controller.searchPlaces(query);
      await waitFor(() => mapVoiceControllerRef.current?.getSnapshot().search === query,
        'se aplicara la búsqueda en el mapa', signal);
      const snapshot = mapVoiceControllerRef.current?.getSnapshot();
      const places = (snapshot?.visiblePlaces ?? []).filter((item) => kind === 'all' || item.kind === kind)
        .sort((a, b) => point ? placeDistanceKm(a, point) - placeDistanceKm(b, point) : 0);
      return { success: true, query, filters: snapshot?.filters, count: places.length,
        dataSource: 'marcadores mostrados en el mapa', demo: places.every((item) => item.demo),
        places: places.slice(0, 20).map((item) => ({ id: item.id, name: item.name,
          kind: item.kind, category: t(item.category), description: item.description,
          location: item.location, ...(point ? { distanceKm: Number(placeDistanceKm(item, point).toFixed(1)) } : {}),
          demo: item.demo })) };
    }

    if (name === 'read_current_screen') {
      const visible = document.querySelector('[data-testid="app-screen"]') as HTMLElement | null;
      if (!visible) return { success: false, message: 'No se pudo leer la pantalla actual.' };
      return { success: true, screen: screenRef.current.name,
        visibleText: visible.innerText.replace(/\n{3,}/g, '\n\n').trim().slice(0, 6000),
        note: 'Texto visible en esta sesión; no presupongas datos que no aparecen aquí.' };
    }

    if (name === 'get_community_catalog') {
      await navigateAndVerify({ name: 'community' }, 'community', signal);
      await waitFor(() => Boolean(communityVoiceControllerRef.current), 'se cargara Comunidad', signal);
      const controller = communityVoiceControllerRef.current;
      if (!controller) throw new Error('No se pudo consultar Comunidad.');
      const source = await controller.refreshListings(signal);
      if (signal.aborted) throw new DOMException('La acción fue cancelada.', 'AbortError');
      const listings = controller.getListings();
      return { success: true, source, count: listings.length,
        demoCount: listings.filter((item) => item.synced === undefined).length,
        categories: COMMUNITY_CATEGORIES.map(({ id, label }) => ({ id, label,
          count: listings.filter((item) => item.category === id).length })),
        listings: listings.slice(0, 20).map((item) => ({ id: item.id, title: item.title,
          category: item.category, location: item.location, price: item.priceRange,
          demo: item.synced === undefined })) };
    }

    if (name === 'search_listings') {
      const query = typeof args.query === 'string' ? args.query.trim().slice(0, 80) : '';
      if (!query) return { success: false, message: 'Indica qué producto o servicio quieres buscar.' };
      let near: { lat: number; lng: number } | null = null;
      let fallbackCommunity = '';
      let locationNote = '';
      if (args.nearMe === true) {
        if (!hasExplicitLocationIntent(lastUserUtterance))
          return { success: false, message: 'Solicita expresamente una búsqueda cercana antes de activar el GPS.' };
        try {
          const point = await getCurrentLocation();
          near = { lat: point.lat, lng: point.lng };
          locationNote = 'Resultados a 30 km o menos del GPS del dispositivo.';
        } catch {
          fallbackCommunity = (typeof args.location === 'string' ? args.location.trim().slice(0, 80) : '') ||
            session.community || settings.community;
          if (!fallbackCommunity) return { success: false, message: 'No pude obtener tu GPS y tu perfil no tiene comunidad. Dime una localidad para buscar allí.' };
          locationNote = `No se obtuvo el GPS; se filtró por ${fallbackCommunity}.`;
        }
      } else if (typeof args.location === 'string') {
        fallbackCommunity = args.location.trim().slice(0, 80);
        locationNote = fallbackCommunity ? `Se filtró por ${fallbackCommunity}.` : '';
      }
      if (signal.aborted) throw new DOMException('La acción fue cancelada.', 'AbortError');
      await navigateAndVerify({ name: 'community' }, 'community', signal);
      await waitFor(() => Boolean(communityVoiceControllerRef.current), 'se cargara Comunidad', signal);
      const controller = communityVoiceControllerRef.current;
      if (!controller) throw new Error('No se pudo abrir Comunidad.');
      const source = await controller.refreshListings(signal);
      if (signal.aborted) throw new DOMException('La acción fue cancelada.', 'AbortError');
      const matches = controller.searchListings(query, near, fallbackCommunity);
      await waitFor(() => (document.querySelector('[data-testid="listing-search"]') as HTMLInputElement | null)?.value === query,
        'se mostraran los resultados de la búsqueda', signal);
      return { success: true, source, count: matches.length, query, locationNote,
        listings: matches.slice(0, 12).map((item) => ({
          id: item.id, title: item.title, description: item.description, author: item.author,
          price: item.priceRange, location: item.location, community: item.community,
          ...(near ? { distanceKm: listingDistanceKm(item, near)?.toFixed(1) } : {}),
          demo: item.synced === undefined,
        })) };
    }

    if (name === 'open_listing') {
      const id = typeof args.listingId === 'string' ? args.listingId : '';
      await navigateAndVerify({ name: 'community' }, 'community', signal);
      await waitFor(() => Boolean(communityVoiceControllerRef.current), 'se cargara Comunidad', signal);
      const controller = communityVoiceControllerRef.current;
      if (!controller?.openListing(id)) return { success: false, message: 'No se encontró esa publicación.' };
      await waitFor(() => Boolean(document.querySelector('.listing-detail-screen h1')), 'se abriera el detalle', signal);
      return { success: true, listingId: id, verified: true };
    }

    if (name === 'search_wall_posts') {
      const query = typeof args.query === 'string' ? args.query.trim().slice(0, 80) : '';
      await navigateAndVerify({ name: 'network', initialTab: 'wall', initialSearch: query }, 'network', signal);
      await waitFor(() => document.querySelector('[data-testid="net-tab-wall"]')?.getAttribute('aria-selected') === 'true',
        'se abriera el muro', signal);
      await waitFor(() => (document.querySelector('[data-testid="wall-search"]') as HTMLInputElement | null)?.value === query,
        'se mostrara la búsqueda del muro', signal);
      const remote = isEffectivelyOnline() ? await readRemotePosts(session.phone, signal) : null;
      if (signal.aborted) throw new DOMException('La acción fue cancelada.', 'AbortError');
      const social = loadSocialState();
      const posts = applySync(social, [], remote).posts.filter((post) =>
        !query || normalizeSearch([post.text, post.author, post.community].join(' ')).includes(normalizeSearch(query)));
      return { success: true, source: remote ? 'server' : 'cache', count: posts.length,
        posts: posts.slice(0, 12).map((post) => ({
        id: post.id, author: post.author, community: post.community, text: post.text, at: post.at,
        demo: post.synced === undefined,
      })) };
    }

    if (name === 'get_my_alerts') {
      const state = typeof args.state === 'string' ? args.state : 'all';
      if (!['all', 'pending', 'sent', 'received', 'canceled'].includes(state))
        return { success: false, message: 'Estado de alerta no reconocido.' };
      await navigateAndVerify({ name: 'history' }, 'history', signal);
      const own = alerts.filter((item) => state === 'all' || item.state === state);
      return { success: true, scope: 'alertas guardadas en este teléfono', count: own.length,
        alerts: own.slice(0, 20).map((item) => ({ id: item.id, type: item.type, state: item.state,
          community: item.community, note: item.note, createdAt: item.createdAt,
          acknowledgedAt: item.acknowledgedAt })) };
    }

    if (name === 'get_environment_reports') {
      await navigateAndVerify({ name: 'history' }, 'history', signal);
      return { success: true, scope: 'reportes guardados en este teléfono', count: biodiversityReports.length,
        reports: biodiversityReports.slice(0, 20).map((item) => ({ id: item.id, category: item.category,
          title: item.title, description: item.description, state: item.state, createdAt: item.createdAt })) };
    }

    if (name === 'get_profile_and_settings' || name === 'update_profile_name' || name === 'update_app_setting') {
      await navigateAndVerify({ name: 'settings' }, 'settings', signal);
      if (name === 'get_profile_and_settings') return { success: true,
        profile: { name: session.name, role: session.role, community: session.community ?? '' },
        settings: { community: settings.community, deviceName: settings.deviceName } };
      if (name === 'update_profile_name') {
        const next = typeof args.name === 'string' ? args.name.trim() : '';
        if (!next || next.length > 80) return { success: false, message: 'El nombre debe tener entre 1 y 80 caracteres.' };
        const input = document.querySelector('[data-testid="settings-profile-name"]') as HTMLInputElement | null;
        input?.focus();
        updateName(next);
        await waitFor(() => (document.querySelector('[data-testid="settings-profile-name"]') as HTMLInputElement | null)?.value === next,
          'se actualizara el nombre visible', signal);
        return { success: true, name: next, verified: true };
      }
      const field = args.field;
      const value = args.value;
      if (
        (field !== 'community' && field !== 'deviceName') ||
        typeof value !== 'string'
      )
        return { success: false, message: 'Campo o valor no permitido.' };
      if (value.length > 80) return { success: false, message: 'El valor supera los 80 caracteres.' };
      if (field === 'deviceName' && !value.trim()) return { success: false, message: 'El nombre del equipo no puede estar vacío.' };
      const input = document.querySelector(`[data-testid="settings-${field}"]`) as HTMLInputElement | null;
      input?.focus();
      if (field === 'community') updateSettings({ community: value });
      else updateSettings({ deviceName: value });
      await waitFor(() => (document.querySelector(`[data-testid="settings-${field}"]`) as HTMLInputElement | null)?.value === value,
        'se actualizara el ajuste visible', signal);
      return { success: true, field, value, verified: true };
    }

    if (name === 'get_admin_pending_emergencies') {
      if (session.role !== 'admin') return { success: false, message: 'Esta función pertenece al administrador de la red de salud.' };
      if (Capacitor.isNativePlatform()) return { success: false,
        message: 'Abre el panel de salud desde Ajustes para consultar emergencias de la red. En Android el panel usa una sesión web separada.' };
      await navigateAndVerify({ name: 'settings' }, 'settings', signal);
      await waitFor(() => Boolean(document.querySelector('[data-testid="settings-admin-panel"]')),
        'se mostrara el acceso al panel de salud', signal);
      (document.querySelector('[data-testid="settings-admin-panel"]') as HTMLElement | null)?.focus();
      const panelSession = await fetch(apiUrl('/api/panel/session'), { cache: 'no-store', signal }).then((res) => res.json()) as
        { authenticated?: boolean; authRequired?: boolean };
      if (!canReadAdminEmergencies(session.role, panelSession.authenticated === true)) return { success: false,
        message: 'Inicia sesión en el panel de salud desde Ajustes para consultar emergencias de la red.' };
      const response = await fetch(apiUrl('/api/alerts'), { cache: 'no-store', signal });
      if (!response.ok) return { success: false, message: 'No se pudieron consultar las emergencias del panel.' };
      const data = await response.json() as { alerts?: ServerAlert[] };
      const pending = (data.alerts ?? []).filter((item) => !item.acknowledgedAt);
      return { success: true, scope: 'panel de la red de salud', panelUrl: '/panel', count: pending.length,
        alerts: pending.slice(0, 20).map((item) => ({ id: item.id, type: item.type,
          community: item.community, note: item.note, createdAt: item.clientCreatedAt,
          deadlineAt: item.ackDeadlineAt })) };
    }

    if (name === 'navigate_to_screen') {
      const target = args.screen;
      if (target === 'community') {
        await navigateAndVerify({ name: 'community' }, 'community', signal);
        communityVoiceControllerRef.current?.showHome();
        return { success: true, screen: 'community', verified: true };
      }
      if (target === 'home' || target === 'map' || target === 'history' || target === 'settings' || target === 'new') {
        await navigateAndVerify({ name: target }, target, signal);
        return { success: true, screen: target, verified: true };
      }
      if (target === 'network') {
        const validTabs = ['wall', 'match', 'agent'] as const;
        const tab = validTabs.find((item) => item === args.tab);
        await navigateAndVerify(
          { name: 'network', ...(tab ? { initialTab: tab } : {}) },
          'network',
          signal,
        );
        return { success: true, screen: 'network', tab: tab ?? 'wall', verified: true };
      }
      if (target === 'biodiversity') {
        await navigateAndVerify({ name: 'biodiversity' }, 'biodiversity', signal);
        return { success: true, screen: target, verified: true };
      }
      if (target === 'alert') {
        const alertId = args.alertId;
        if (typeof alertId !== 'string' || !alertsRef.current.some((item) => item.id === alertId)) {
          return { success: false, message: 'No se encontró esa alerta.' };
        }
        await navigateAndVerify({ name: 'alert', id: alertId }, 'alert', signal);
        return { success: true, screen: 'alert', alertId, verified: true };
      }
      return { success: false, message: 'No reconozco esa pantalla de Manguaré.' };
    }

    if (name === 'open_listing_form') {
      await navigateAndVerify({ name: 'community' }, 'community', signal);
      const controller = communityVoiceControllerRef.current;
      if (!controller) throw new Error('No se pudo conectar con la pantalla Comunidad.');
      controller.openListingForm();
      await waitFor(
        () => {
          const input = document.querySelector('[data-testid="listing-title"]');
          return Boolean(input && (input as HTMLElement).getClientRects().length);
        },
        'se abriera el formulario de publicación',
        signal,
      );
      await requireListingForm(signal);
      return {
        success: true,
        screen: 'community',
        form: 'listing',
        verified: true,
      };
    }

    if (name === 'get_listing_form_schema') {
      await requireListingForm(signal);
      return { success: true, fields: voiceListingFieldSchema() };
    }

    if (name === 'get_listing_form_values') {
      const form = await requireListingForm(signal);
      const values = form.getValues();
      const validation = validateVoiceListing(values);
      return {
        success: true,
        values,
        missingRequiredFields: validation.missing,
        photoAttached: values.photoAttached ?? false,
      };
    }

    if (name === 'update_listing_form_fields') {
      const form = await requireListingForm(signal);
      const patch: ListingFormPatch = {};
      for (const field of ['title', 'category', 'price', 'location', 'description'] as const) {
        if (Object.prototype.hasOwnProperty.call(args, field)) {
          if (typeof args[field] !== 'string') {
            return { success: false, message: `El campo ${field} debe ser texto.` };
          }
          patch[field] = args[field];
        }
      }
      if (Object.keys(patch).length === 0) {
        return { success: false, message: 'No se recibió ningún campo válido para actualizar.' };
      }
      return form.updateFields(patch);
    }

    if (name === 'validate_listing_form') {
      const form = await requireListingForm(signal);
      const values = form.getValues();
      const validation = form.validateForVoice();
      return {
        success: validation.valid,
        valid: validation.valid,
        missingRequiredFields: validation.missing,
        values,
      };
    }

    if (name === 'use_current_location') {
      if (!hasExplicitLocationIntent(lastUserUtterance))
        return { success: false, message: 'Pide expresamente usar tu ubicación para la publicación.' };
      const form = await requireListingForm(signal);
      const location = await getCurrentLocation();
      if (signal.aborted) throw new DOMException('La acción fue cancelada.', 'AbortError');
      const label = `GPS: ${location.lat}, ${location.lng}`;
      const update = form.updateFields({ location: label });
      if (!update.success) return update;
      form.setCoordinates({
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
      });
      return {
        success: true,
        message: 'Se obtuvo y guardó la ubicación GPS real.',
        location: label,
        coordinates: {
          lat: location.lat,
          lng: location.lng,
          accuracy: location.accuracy,
        },
      };
    }

    if (name === 'request_listing_publication_confirmation') {
      const form = await requireListingForm(signal);
      const values = form.getValues();
      const validation = form.validateForVoice();
      if (!validation.valid) {
        pendingPublicationRef.current = null;
        return {
          success: false,
          message: 'Completa los campos faltantes antes de preparar la confirmación.',
          missingRequiredFields: validation.missing,
        };
      }
      const id = globalThis.crypto?.randomUUID?.() ?? `publish-${Date.now()}-${Math.random()}`;
      pendingPublicationRef.current = { id, snapshot: form.getPublicationSnapshot() };
      return {
        success: true,
        confirmationId: id,
        summary: summarizeVoiceListing(values),
        requiresExplicitVerbalConfirmation: true,
        message: 'Lee el resumen y pregunta si autoriza publicar. Aún no se ha publicado.',
      };
    }

    if (name === 'publish_listing') {
      const pending = pendingPublicationRef.current;
      if (!pending || args.confirmationId !== pending.id) {
        return {
          success: false,
          message: 'No hay una confirmación vigente. Prepara y lee un nuevo resumen primero.',
        };
      }
      if (!isExplicitPublicationConfirmation(lastUserUtterance)) {
        return {
          success: false,
          message: 'No se detectó una autorización verbal explícita del usuario; no se publicó.',
        };
      }
      const form = await requireListingForm(signal);
      if (form.getPublicationSnapshot() !== pending.snapshot) {
        pendingPublicationRef.current = null;
        return {
          success: false,
          message: 'El formulario cambió después del resumen. Valídalo y solicita confirmación nuevamente.',
        };
      }
      const validation = form.validateForVoice();
      if (!validation.valid) {
        pendingPublicationRef.current = null;
        return {
          success: false,
          message: 'El formulario ya no está completo; no se publicó.',
          missingRequiredFields: validation.missing,
        };
      }
      const result = form.publish();
      if (result.success) pendingPublicationRef.current = null;
      return result;
    }

    if (name === 'cancel_listing_publication') {
      pendingPublicationRef.current = null;
      return { success: true, message: 'La publicación no se realizó.' };
    }

    return {
      success: false,
      message: `Herramienta no disponible: ${name}.`,
    };
  };
  const goHome = () => setScreen({ name: 'home' });
  const goCommunity = () => setScreen({ name: 'community' });
  const goHistory = () => setScreen({ name: 'history' });
  const goTab = (tab: Tab) => {
    if (tab === 'home') setScreen({ name: 'home' });
    else if (tab === 'community') setScreen({ name: 'community' });
    else if (tab === 'network') setScreen({ name: 'network' });
    else if (tab === 'map') setScreen({ name: 'map' });
    else if (tab === 'history') setScreen({ name: 'history' });
    else setScreen({ name: 'settings' });
  };


  const activeTab: Tab | null =
    screen.name === 'home'
      ? 'home'
      : screen.name === 'community'
        ? 'community'
        : screen.name === 'network'
          ? 'network'
          : screen.name === 'map'
          ? 'map'
            : screen.name === 'history'
              ? 'history'
              : screen.name === 'settings'
                ? 'settings'
                : screen.name === 'alert'
                  ? 'history'
                  : null;

  return (
    <div className="app-backdrop">
      <div className={`app-shell ${screen.name === 'new' ? 'is-wizard' : ''}`}>
        {screen.name === 'home' ? <TopBar onLanguage={() => setLanguageOpen(true)} /> : null}

        <main className="app-main" data-testid="app-screen" data-screen={screen.name}>
          {screen.name === 'home' ? (
            <HomeScreen
              onOpenAlert={(id) => setScreen({ name: 'alert', id })}
              onHistory={goHistory}
              onCommunity={() => setScreen({ name: 'community' })}
              onOpenAssistant={() => setScreen({ name: 'network', initialTab: 'agent' })}
              onSOS={() => setSosConfirmOpen(true)}
              onOpenLanguage={() => setLanguageOpen(true)}
              onOpenHelp={() => setHelpOpen(true)}
            />
          ) : null}

          {screen.name === 'community' ? (
            <CommunityScreen
              onReportBiodiversity={(category) =>
                setScreen({ name: 'biodiversity', category })
              }
              onOpenVoice={openVoice}
              onVoiceControllerReady={registerCommunityVoiceController}
            />
          ) : null}

          {screen.name === 'network' ? (
            <NetworkScreen
              onNewAlert={() => setScreen({ name: 'new' })}
              onOpenCommunity={goCommunity}
              onOpenVoice={openVoice}
              initialTab={screen.initialTab}
              initialSearch={screen.initialSearch}
            />
          ) : null}

          {screen.name === 'map' ? (
            <Suspense fallback={<div className="inline-loading">{t('map.cargandoMapa')}</div>}>
              <MapScreen isAdmin={session?.role === 'admin'} onSOS={() => setSosConfirmOpen(true)}
                onVoiceControllerReady={registerMapVoiceController} />
            </Suspense>
          ) : null}

          {screen.name === 'biodiversity' ? (
            <BiodiversityReportScreen
              category={screen.category}
              onCancel={goCommunity}
            />
          ) : null}

          {screen.name === 'history' ? (
            <HistoryScreen
              onOpenAlert={(id) => setScreen({ name: 'alert', id })}
              onNew={() => setScreen({ name: 'new' })}
            />
          ) : null}

          {screen.name === 'settings' ? (
            <SettingsScreen onOpenLanguage={() => setLanguageOpen(true)} />
          ) : null}

          {screen.name === 'new' ? (
            <NewAlertScreen
              onCancel={goHome}
              onCreated={(id) => setScreen({ name: 'alert', id })}
              sos={screen.sos === true}
            />
          ) : null}

          {screen.name === 'alert' ? (
            <AlertDetailScreen
              id={screen.id}
              onBack={goHistory}
              onHistory={goHistory}
            />
          ) : null}
        </main>
        {voiceOpen && (
          <VoiceAssistant
            onClose={closeVoice}
            onToolCall={handleVoiceToolCall}
          />
        )}

        {screen.name !== 'new' ? (
          <BottomNav
            active={activeTab}
            onChange={goTab}
          />
        ) : null}

        <LanguageSheet open={languageOpen} onClose={() => setLanguageOpen(false)} />
        <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
        <Toast behindSheet={languageOpen || helpOpen || sosConfirmOpen} />

        <Sheet
          open={sosConfirmOpen}
          title={t('sos.deseaEnviarUnaAlertaDeEmergencia')}
          onClose={() => setSosConfirmOpen(false)}
          footer={
            <div className="sos-confirm-actions">
              <button
                type="button"
                className="btn btn-secondary btn-lg"
                data-testid="sos-confirm-cancel"
                onClick={() => setSosConfirmOpen(false)}
              >
                {t('common.no')}
              </button>
              <button
                type="button"
                className="btn btn-danger btn-lg"
                data-testid="sos-confirm-send"
                onClick={() => {
                  setSosConfirmOpen(false);
                  setScreen({ name: 'new', sos: true });
                }}
              >
                {t('sos.siEnviar')}
              </button>
            </div>
          }
        >
          <p className="sheet-intro">
            {t('sos.enviaremosTuNombreLaHoraY')}
          </p>
        </Sheet>
      </div>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');

  if (!session) {
    if (authScreen === 'register') {
      return (
        <RegisterScreen
          onCancel={() => setAuthScreen('login')}
          onRegistered={(next) => {
            saveSession(next);
            setSession(next);
            setAuthScreen('login');
          }}
        />
      );
    }
    return (
      <LoginScreen
        onLogin={(next) => {
          saveSession(next);
          setSession(next);
        }}
        onRegister={() => setAuthScreen('register')}
      />
    );
  }

  return (
    <SessionProvider
      session={session}
      updateName={(name) => {
        saveProfileName(session.phone, name);
        const next = { ...session, name: name.trim() };
        saveSession(next);
        setSession(next);
      }}
      logout={() => {
        clearSession();
        setSession(null);
        setAuthScreen('login');
      }}
    >
      <AppProvider>
        <AppShell />
      </AppProvider>
    </SessionProvider>
  );
}
