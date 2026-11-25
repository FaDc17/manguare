// Traduce los rótulos de búsqueda, filtros y permisos del mapa.

import { LocalizedText, useTranslation } from '../i18n/LanguageContext';
import { MapZoom } from '../components/MapZoom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import { LocateFixed, Map as MapIcon, MapPin, RefreshCw, Search, TriangleAlert } from 'lucide-react';
import { useApp } from '../app/AppContext';
import type { MessageKey } from '../i18n/catalog';
import { SUPPORT_CENTERS } from '../lib/community';
import { apiUrl } from '../lib/api-url';
import {
  emergencyMapPlaces,
  MAP_PLACES,
  filterMapPlaces,
  type MapKind,
  type MapPlace,
  type MapVoiceController,
} from '../lib/map-data';
import type { AlertLocation, ServerMapAlert } from '../lib/types';
import 'leaflet/dist/leaflet.css';

function MapFocus({
  result,
  userLocation,
  emergencyPlaces,
}: {
  result?: MapPlace;
  userLocation?: AlertLocation;
  emergencyPlaces: MapPlace[];
}) {
  const map = useMap();
  const emergencySignature = emergencyPlaces
    .map((place) => `${place.id}:${place.coordinates.lat}:${place.coordinates.lng}`)
    .join('|');
  useEffect(() => {
    if (result) {
      map.flyTo([result.coordinates.lat, result.coordinates.lng], 14, { duration: 0.6 });
    } else if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 0.6 });
    } else if (emergencyPlaces.length === 1) {
      const [place] = emergencyPlaces;
      map.flyTo([place.coordinates.lat, place.coordinates.lng], 13, { duration: 0.6 });
    } else if (emergencyPlaces.length > 1) {
      map.fitBounds(emergencyPlaces.map((place) => [place.coordinates.lat, place.coordinates.lng]), {
        padding: [28, 28],
        maxZoom: 11,
      });
    }
  }, [emergencySignature, map, result?.id, userLocation?.lat, userLocation?.lng]);
  return null;
}

export function MapScreen({ onSOS, isAdmin, onVoiceControllerReady }: {
  onSOS: () => void;
  isAdmin: boolean;
  onVoiceControllerReady?: (controller: MapVoiceController | null) => void;
}) {
  const { online } = useApp();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<MapKind, boolean>>({
    emergency: isAdmin,
    conecta: true,
    support: true,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<AlertLocation>();
  const [locationMessage, setLocationMessage] = useState('');
  const [locating, setLocating] = useState(false);
  const [adminAccess, setAdminAccess] = useState<'closed' | 'loading' | 'ready' | 'required' | 'unconfigured'>(
    isAdmin ? 'loading' : 'closed',
  );
  const [adminAlerts, setAdminAlerts] = useState<ServerMapAlert[]>([]);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminError, setAdminError] = useState<MessageKey | null>(null);
  const adminBusyRef = useRef(false);

  const emergencyPlaces = useMemo(
    () => isAdmin && adminAccess === 'ready'
      ? emergencyMapPlaces(adminAlerts, t)
      : [],
    [adminAccess, adminAlerts, isAdmin, t],
  );
  const places = useMemo(() => [...MAP_PLACES, ...emergencyPlaces], [emergencyPlaces]);
  const results = useMemo(() => filterMapPlaces(places, search, activeFilters, t),
    [activeFilters, places, search, t]);
  const selected = results.find((item) => item.id === selectedId);

  const loadAdminAlerts = useCallback(async () => {
    if (!online || !isAdmin || adminBusyRef.current) return;
    adminBusyRef.current = true;
    setAdminBusy(true);
    setAdminError(null);
    try {
      const response = await fetch(apiUrl('/api/panel/map-alerts'), {
        credentials: 'include',
        cache: 'no-store',
      });
      if (response.status === 401) {
        setAdminAlerts([]);
        setAdminAccess('required');
        setAdminError('map.adminSessionRequired');
        return;
      }
      if (response.status === 503) {
        setAdminAlerts([]);
        setAdminAccess('unconfigured');
        setAdminError('map.adminAuthNotConfigured');
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { alerts?: ServerMapAlert[] };
      setAdminAlerts(Array.isArray(data.alerts) ? data.alerts : []);
      setAdminAccess('ready');
    } catch {
      setAdminError('map.adminMapLoadFailed');
    } finally {
      adminBusyRef.current = false;
      setAdminBusy(false);
    }
  }, [isAdmin, online]);

  useEffect(() => {
    if (!isAdmin) {
      setAdminAlerts([]);
      setAdminAccess('closed');
      setAdminError(null);
      setActiveFilters((current) => ({ ...current, emergency: false }));
      setSelectedId((current) => current?.startsWith('emergency:') ? null : current);
      return;
    }
    if (online) {
      setAdminAccess('loading');
      void loadAdminAlerts();
    }
  }, [isAdmin, loadAdminAlerts, online]);

  useEffect(() => {
    if (!isAdmin || !online) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') void loadAdminAlerts();
    };
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [isAdmin, loadAdminAlerts, online]);

  useEffect(() => {
    if (!onVoiceControllerReady) return;
    onVoiceControllerReady({
      getSnapshot: () => ({ search, filters: activeFilters, selectedId, userLocation, visiblePlaces: results }),
      searchPlaces: (query) => { setSearch(query); setSelectedId(null); },
      selectPlace: (id) => {
        if (!results.some((item) => item.id === id)) return false;
        setSelectedId(id);
        return true;
      },
    });
    return () => onVoiceControllerReady(null);
  }, [onVoiceControllerReady, search, activeFilters, selectedId, userLocation, results]);

  const activateLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage(t('map.esteNavegadorNoOfreceGeolocalizacion'));
      return;
    }
    setLocating(true);
    setLocationMessage('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy),
          capturedAt: new Date(position.timestamp).toISOString(),
        });
        setLocating(false);
      },
      () => {
        setLocationMessage(t('map.noSePudoObtenerTuUbicacion'));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  const selectResult = (item: MapPlace) => setSelectedId(item.id);
  const toggleFilter = (filter: MapKind) => {
    setActiveFilters((current) => ({ ...current, [filter]: !current[filter] }));
    setSelectedId(null);
  };
  return (
    <div className="screen map-screen">
      <header className="map-screen-head">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" />{' '}{t('map.exploraTuZona')}</p>
          <h1><LocalizedText id="navigation.map" /></h1>
        </div>
        <button type="button" className="map-sos" onClick={onSOS}>
          <TriangleAlert size={16} aria-hidden="true" /> SOS
        </button>
      </header>

      {!online ? (
        <p className="map-offline-note">{t('map.sinConexionElMapaNoPuede')}</p>
      ) : null}

      <section className="map-controls" aria-label={t('map.buscarYFiltrarEnElMapa')}>
        <button
          type="button"
          className="btn btn-secondary btn-block map-location-button"
          onClick={activateLocation}
          disabled={locating}
        >
          <LocateFixed size={19} aria-hidden="true" />
          {locating ? t('map.buscandoUbicacion') : userLocation ? t('map.actualizarMiUbicacion') : t('map.activarMiUbicacion')}
        </button>
        {locationMessage ? <p className="field-error" role="status">{locationMessage}</p> : null}
        <label className="map-search">
          <Search size={19} aria-hidden="true" />
          <input
            data-testid="map-search-input"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelectedId(null);
            }}
            placeholder={t('map.buscaPorNombreOCategoria')}
            aria-label={t('map.buscarPorNombreOCategoria')}
          />
        </label>
        <div className="map-filters" aria-label={t('map.filtros')}>
          {isAdmin ? (
            <button
              type="button"
              data-testid="map-filter-emergency"
              className={activeFilters.emergency ? 'is-active' : ''}
              aria-pressed={activeFilters.emergency}
              onClick={() => toggleFilter('emergency')}
            >
              {t('map.emergencias')}
            </button>
          ) : null}
          <button
            type="button"
            data-testid="map-filter-conecta"
            className={activeFilters.conecta ? 'is-active' : ''}
            aria-pressed={activeFilters.conecta}
            onClick={() => toggleFilter('conecta')}
          >
            {t('map.conecta')}
          </button>
          <button
            type="button"
            data-testid="map-filter-support"
            className={activeFilters.support ? 'is-active' : ''}
            aria-pressed={activeFilters.support}
            onClick={() => toggleFilter('support')}
          >
            {t('map.centroDeApoyo')}
          </button>
          {isAdmin ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void loadAdminAlerts()}
              disabled={adminBusy || !online}
            >
              <RefreshCw size={16} aria-hidden="true" />
              {adminBusy ? t('map.cargandoEmergencias') : t('map.actualizarEmergencias')}
            </button>
          ) : null}
        </div>
        {isAdmin && activeFilters.emergency && adminAccess !== 'ready' ? (
          <p className="map-empty" role={adminError ? 'alert' : 'status'}>
            {adminError ? t(adminError) : t('map.cargandoEmergencias')}
          </p>
        ) : null}
        {results.length ? (
          <div className="map-result-list" aria-label={t('map.resultadosDeBusqueda')}>
            {results.map((item) => (
              <button
                type="button"
                key={item.id}
                className={selectedId === item.id ? 'is-selected' : ''}
                onClick={() => selectResult(item)}
              >
                <span>{item.name}</span>
                <small>{item.kind === 'emergency' ? t('map.emergencias')
                  : item.kind === 'conecta' ? t('map.conecta') : t('map.centroDeApoyo')}</small>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="map-results" aria-label={t('map.mapaDePublicacionesYCentrosDe')}>
        <MapContainer
          className="map-canvas"
          center={[-5.0, -77.95]}
          zoom={8}
          zoomControl={false}
          scrollWheelZoom
        >
          <MapZoom />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapFocus result={selected} userLocation={userLocation} emergencyPlaces={emergencyPlaces} />
          {results.map((item) => (
            <CircleMarker
              key={item.id}
              center={[item.coordinates.lat, item.coordinates.lng]}
              radius={selectedId === item.id ? 11 : 8}
              pathOptions={{
                color: item.kind === 'emergency' ? '#b3261e' : item.kind === 'conecta' ? '#1e684f' : '#9a5735',
                fillColor: item.kind === 'emergency' ? '#b3261e' : item.kind === 'conecta' ? '#1e684f' : '#9a5735',
                fillOpacity: 0.92,
                weight: item.kind === 'emergency' ? 3 : 2,
              }}
              eventHandlers={{ click: () => selectResult(item) }}
            >
              <Popup>
                <strong>{item.name}</strong>
                <br />
                {t(item.category)}
                <br />
                {item.location}
              </Popup>
            </CircleMarker>
          ))}
          {userLocation ? (
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={8}
              pathOptions={{ color: '#fff', fillColor: '#236e8a', fillOpacity: 1, weight: 3 }}
            >
              <Popup>{t('map.tuUbicacionSoloVisibleEnEste')}</Popup>
            </CircleMarker>
          ) : null}
        </MapContainer>
        <p className="map-privacy">
          <MapIcon size={14} aria-hidden="true" />
          {isAdmin && adminAccess === 'ready'
            ? t('map.soloPersonalAdministradorPuedeVer')
            : t('map.soloMuestraPublicacionesYCentrosDe')}
        </p>
        {selected ? (
          <article className="map-selected" data-testid="map-selected">
            <span className={`map-selected-pin is-${selected.kind}`}>
              <MapPin size={18} aria-hidden="true" />
            </span>
            <div>
              <strong>{selected.name}</strong>
              <span>{t(selected.category)} · {selected.location}</span>
              {selected.kind === 'support' ? (
                <p>{t('community.supportNote')}</p>
              ) : selected.description ? <p>{selected.description}</p> : null}
            </div>
          </article>
        ) : null}
        {isAdmin && adminAccess === 'ready' && emergencyPlaces.length === 0 ? (
          <p className="map-empty" role="status">{t('map.noHayEmergenciasConUbicacion')}</p>
        ) : null}
        {results.length === 0 ? (
          <p className="map-empty">{t('map.noEncontramosResultadosConEsosFiltros')}</p>
        ) : null}
      </section>

      <section className="map-suggestions" aria-labelledby="map-suggestions-title">
        <div className="section-head">
          <h2 id="map-suggestions-title">{t('map.centrosDeApoyo')}</h2>
          <span className="demo-badge">{t('map.ubicacionAproximada')}</span>
        </div>
        {SUPPORT_CENTERS.map((center) => (
          <button
            key={center.id}
            type="button"
            className="map-suggestion"
            onClick={() => {
              const result = MAP_PLACES.find((item) => item.id === center.id);
              if (result) selectResult(result);
            }}
          >
            <span className="center-icon"><MapPin size={18} aria-hidden="true" /></span>
            <span>
              <strong>{center.name}</strong>
              <small>{center.distance} · {t('community.supportNote')}</small>
            </span>
          </button>
        ))}
      </section>
    </div>
  );
}
