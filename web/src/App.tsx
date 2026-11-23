// Organiza las pantallas y vincula el selector de idioma con los avisos y diálogos de la app.

import { message } from './i18n/catalog';
import { useTranslation } from './i18n/LanguageContext';
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
import { SOS_DEFAULT_NOTE } from './lib/emergency';
import type { AlertLocation, BiodiversityCategory, ServerAlert } from './lib/types';
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
import { VoiceAssistant } from './components/VoiceAssistant';
import { getCurrentLocation } from './lib/geography';
import { loadSocialState } from './lib/social';
import type { CommunityVoiceController } from './lib/voice-tools';
import {
  isExplicitPublicationConfirmation,
  summarizeVoiceListing,
  validateVoiceListing,
  voiceListingFieldSchema,
  listingDistanceKm,
  normalizeSearch,
  voiceCapabilities,
  canReadAdminEmergencies,
  type ListingFormPatch,
  type VoiceToolContext,
} from './lib/voice-tools';

const MapScreen = lazy(() =>
  import('./screens/MapScreen').then((module) => ({ default: module.MapScreen })),
);

type Screen =
  | { name: 'home' }
  | { name: 'community' }
  | { name: 'network'; initialTab?: 'wall' | 'match' | 'agent'; initialSearch?: string }
  | { name: 'map' }
  | { name: 'biodiversity'; category?: BiodiversityCategory }
  | { name: 'history' }
  | { name: 'settings' }
  | { name: 'new' }
  | { name: 'alert'; id: string };

function AppShell() {
  const { t } = useTranslation();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [languageOpen, setLanguageOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sosConfirmOpen, setSosConfirmOpen] = useState(false);
  const [sosSending, setSosSending] = useState(false);
  const { createAlert, alerts, biodiversityReports, settings, updateSettings, showToast } = useApp();
  const { session, updateName } = useSession();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const communityVoiceControllerRef = useRef<CommunityVoiceController | null>(null);
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

    if (name === 'get_app_context') {
      return {
        success: true, role: session.role, screen: screenRef.current.name,
        capabilities: voiceCapabilities(session.role),
        note: session.role === 'admin'
          ? 'Las emergencias de la red requieren además una sesión autenticada en el panel de salud.'
          : 'Las alertas del Historial pertenecen a este teléfono; las emergencias de la red solo están en el panel administrador.',
      };
    }

    if (name === 'read_current_screen') {
      const visible = document.querySelector('[data-testid="app-screen"]') as HTMLElement | null;
      if (!visible) return { success: false, message: 'No se pudo leer la pantalla actual.' };
      return { success: true, screen: screenRef.current.name,
        visibleText: visible.innerText.replace(/\n{3,}/g, '\n\n').trim().slice(0, 6000),
        note: 'Texto visible en esta sesión; no presupongas datos que no aparecen aquí.' };
    }

    if (name === 'search_listings') {
      const query = typeof args.query === 'string' ? args.query.trim().slice(0, 80) : '';
      if (!query) return { success: false, message: 'Indica qué producto o servicio quieres buscar.' };
      let near: { lat: number; lng: number } | null = null;
      let fallbackCommunity = '';
      let locationNote = '';
      if (args.nearMe === true) {
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
      const matches = controller.searchListings(query, near, fallbackCommunity);
      await waitFor(() => (document.querySelector('[data-testid="listing-search"]') as HTMLInputElement | null)?.value === query,
        'se mostraran los resultados de la búsqueda', signal);
      return { success: true, count: matches.length, query, locationNote,
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
      const posts = loadSocialState().posts.filter((post) =>
        !query || normalizeSearch([post.text, post.author, post.community].join(' ')).includes(normalizeSearch(query)));
      return { success: true, count: posts.length, posts: posts.slice(0, 12).map((post) => ({
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
        settings: { community: settings.community, deviceName: settings.deviceName,
          healthPost: settings.healthPost, healthPhone: settings.healthPhone, smsNumber: settings.smsNumber } };
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
      const allowed = ['community', 'deviceName', 'healthPost', 'healthPhone', 'smsNumber'] as const;
      if (typeof field !== 'string' || !allowed.some((item) => item === field) || typeof value !== 'string')
        return { success: false, message: 'Campo o valor no permitido.' };
      if (value.length > 80) return { success: false, message: 'El valor supera los 80 caracteres.' };
      if (field === 'deviceName' && !value.trim()) return { success: false, message: 'El nombre del equipo no puede estar vacío.' };
      const input = document.querySelector(`[data-testid="settings-${field}"]`) as HTMLInputElement | null;
      input?.focus();
      updateSettings({ [field]: value });
      await waitFor(() => (document.querySelector(`[data-testid="settings-${field}"]`) as HTMLInputElement | null)?.value === value,
        'se actualizara el ajuste visible', signal);
      return { success: true, field, value, verified: true };
    }

    if (name === 'get_admin_pending_emergencies') {
      if (session.role !== 'admin') return { success: false, message: 'Esta función pertenece al administrador de la red de salud.' };
      await navigateAndVerify({ name: 'settings' }, 'settings', signal);
      await waitFor(() => Boolean(document.querySelector('[data-testid="settings-admin-panel"]')),
        'se mostrara el acceso al panel de salud', signal);
      (document.querySelector('[data-testid="settings-admin-panel"]') as HTMLElement | null)?.focus();
      const panelSession = await fetch('/api/panel/session', { cache: 'no-store', signal }).then((res) => res.json()) as
        { authenticated?: boolean; authRequired?: boolean };
      if (!canReadAdminEmergencies(session.role, panelSession.authenticated === true)) return { success: false,
        message: 'Inicia sesión en el panel de salud desde Ajustes para consultar emergencias de la red.' };
      const response = await fetch('/api/alerts', { cache: 'no-store', signal });
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
              <MapScreen onSOS={() => setSosConfirmOpen(true)} />
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
          onClose={() => {
            if (!sosSending) setSosConfirmOpen(false);
          }}
          footer={
            <div className="sos-confirm-actions">
              <button
                type="button"
                className="btn btn-secondary btn-lg"
                data-testid="sos-confirm-cancel"
                disabled={sosSending}
                onClick={() => setSosConfirmOpen(false)}
              >
                {t('common.no')}
              </button>
              <button
                type="button"
                className="btn btn-danger btn-lg"
                data-testid="sos-confirm-send"
                disabled={sosSending}
                onClick={() => void sendSosAlert()}
              >
                {sosSending ? t('sos.enviando') : t('sos.siEnviar')}
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

  async function sendSosAlert() {
    if (sosSending) return;
    const recentSos = alerts.find(
      (item) =>
        item.isSos &&
        item.state !== 'canceled' &&
        Date.now() - Date.parse(item.createdAt) < 2 * 60_000,
    );
    if (recentSos) {
      setSosConfirmOpen(false);
      setScreen({ name: 'alert', id: recentSos.id });
      showToast(message('sos.yaHayUnaAlertaSosReciente'), 'warn');
      return;
    }
    setSosSending(true);
    try {
      const location = await captureSosLocation();
      const alert = await createAlert({
        type: 'otro',
        isSos: true,
        note: SOS_DEFAULT_NOTE,
        community: settings.community,
        deviceName: settings.deviceName,
        reportedBy: session.name,
        reporterPhone: session.phone,
        location,
        consentLocation: Boolean(location),
      });
      setSosConfirmOpen(false);
      setScreen({ name: 'alert', id: alert.id });
      if (!location) {
        showToast(t('sos.noSeObtuvoElGpsLa'), 'warn');
      } else if (!isEffectivelyOnline()) {
        showToast(t('sos.alertaPendienteSeEnviaraAlRecuperar'), 'warn');
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t('sos.noSePudoGuardarLaAlerta'),
        'error',
      );
    } finally {
      setSosSending(false);
    }
  }
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

function captureSosLocation(): Promise<AlertLocation | undefined> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy),
          capturedAt: new Date(position.timestamp).toISOString(),
        });
      },
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60_000 },
    );
  });
}
