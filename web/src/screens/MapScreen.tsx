import { useEffect, useMemo, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import { LocateFixed, Map as MapIcon, MapPin, Search, TriangleAlert } from 'lucide-react';
import { useApp } from '../app/AppContext';
import { COMMUNITY_CATEGORIES, COMMUNITY_LISTINGS, SUPPORT_CENTERS } from '../lib/community';
import type { AlertLocation } from '../lib/types';
import 'leaflet/dist/leaflet.css';

type MapKind = 'conecta' | 'support';
type Filter = 'conecta' | 'support';

interface MapResult {
  id: string;
  kind: MapKind;
  name: string;
  category: string;
  description: string;
  location: string;
  coordinates: { lat: number; lng: number };
}

const RESULTS: MapResult[] = [
  ...COMMUNITY_LISTINGS.filter(
    (listing): listing is typeof listing & { coordinates: { lat: number; lng: number } } =>
      Boolean(listing.coordinates),
  ).map((listing) => ({
    id: listing.id,
    kind: 'conecta' as const,
    name: listing.title,
    category: COMMUNITY_CATEGORIES.find((item) => item.id === listing.category)?.label ?? 'Conecta',
    description: listing.description,
    location: listing.location,
    coordinates: listing.coordinates,
  })),
  ...SUPPORT_CENTERS.map((center) => ({
    id: center.id,
    kind: 'support' as const,
    name: center.name,
    category: 'Centro de apoyo',
    description: center.note,
    location: center.distance,
    coordinates: center.coordinates,
  })),
];

function MapFocus({
  result,
  userLocation,
}: {
  result?: MapResult;
  userLocation?: AlertLocation;
}) {
  const map = useMap();
  useEffect(() => {
    if (result) {
      map.flyTo([result.coordinates.lat, result.coordinates.lng], 14, { duration: 0.6 });
    } else if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 0.6 });
    }
  }, [map, result?.id, userLocation?.lat, userLocation?.lng]);
  return null;
}

export function MapScreen({ onSOS }: { onSOS: () => void }) {
  const { online } = useApp();
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<Filter, boolean>>({
    conecta: true,
    support: true,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<AlertLocation>();
  const [locationMessage, setLocationMessage] = useState('');
  const [locating, setLocating] = useState(false);

  const results = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    return RESULTS.filter((item) => {
      if (!activeFilters[item.kind]) return false;
      if (!query) return true;
      return `${item.name} ${item.category} ${item.location}`
        .toLocaleLowerCase('es')
        .includes(query);
    });
  }, [activeFilters, search]);
  const selected = results.find((item) => item.id === selectedId);

  const activateLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Este navegador no ofrece geolocalización.');
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
        setLocationMessage('No se pudo obtener tu ubicación. Revisa el permiso del navegador.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  const selectResult = (item: MapResult) => setSelectedId(item.id);
  const toggleFilter = (filter: Filter) => {
    setActiveFilters((current) => ({ ...current, [filter]: !current[filter] }));
    setSelectedId(null);
  };
  return (
    <div className="screen map-screen">
      <header className="map-screen-head">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> Explora tu zona</p>
          <h1>Mapa</h1>
        </div>
        <button type="button" className="map-sos" onClick={onSOS}>
          <TriangleAlert size={16} aria-hidden="true" /> SOS
        </button>
      </header>

      {!online ? (
        <p className="map-offline-note">
          Sin conexión: el mapa no puede cargar las teselas. La lista de resultados y tus
          coordenadas siguen funcionando.
        </p>
      ) : null}

      <section className="map-controls" aria-label="Buscar y filtrar en el mapa">
        <button
          type="button"
          className="btn btn-secondary btn-block map-location-button"
          onClick={activateLocation}
          disabled={locating}
        >
          <LocateFixed size={19} aria-hidden="true" />
          {locating ? 'Buscando ubicación…' : userLocation ? 'Actualizar mi ubicación' : 'Activar mi ubicación'}
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
            placeholder="Busca por nombre o categoría"
            aria-label="Buscar por nombre o categoría"
          />
        </label>
        <div className="map-filters" aria-label="Filtros">
          <button
            type="button"
            data-testid="map-filter-conecta"
            className={activeFilters.conecta ? 'is-active' : ''}
            aria-pressed={activeFilters.conecta}
            onClick={() => toggleFilter('conecta')}
          >
            Conecta
          </button>
          <button
            type="button"
            data-testid="map-filter-support"
            className={activeFilters.support ? 'is-active' : ''}
            aria-pressed={activeFilters.support}
            onClick={() => toggleFilter('support')}
          >
            Centro de apoyo
          </button>
        </div>
        {results.length ? (
          <div className="map-result-list" aria-label="Resultados de búsqueda">
            {results.map((item) => (
              <button
                type="button"
                key={item.id}
                className={selectedId === item.id ? 'is-selected' : ''}
                onClick={() => selectResult(item)}
              >
                <span>{item.name}</span>
                <small>{item.kind === 'conecta' ? 'Conecta' : 'Centro de apoyo'}</small>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="map-results" aria-label="Mapa de publicaciones y centros de apoyo">
        <MapContainer
          className="map-canvas"
          center={[-5.0, -77.95]}
          zoom={8}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapFocus result={selected} userLocation={userLocation} />
          {results.map((item) => (
            <CircleMarker
              key={item.id}
              center={[item.coordinates.lat, item.coordinates.lng]}
              radius={selectedId === item.id ? 11 : 8}
              pathOptions={{
                color: item.kind === 'conecta' ? '#1e684f' : '#9a5735',
                fillColor: item.kind === 'conecta' ? '#1e684f' : '#9a5735',
                fillOpacity: 0.92,
                weight: 2,
              }}
              eventHandlers={{ click: () => selectResult(item) }}
            >
              <Popup>
                <strong>{item.name}</strong>
                <br />
                {item.category}
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
              <Popup>Tu ubicación (solo visible en este dispositivo)</Popup>
            </CircleMarker>
          ) : null}
        </MapContainer>
        <p className="map-privacy">
          <MapIcon size={14} aria-hidden="true" />
          Solo muestra publicaciones y centros de apoyo; no incluye alertas ni datos personales.
        </p>
        {selected ? (
          <article className="map-selected" data-testid="map-selected">
            <span className={`map-selected-pin is-${selected.kind}`}>
              <MapPin size={18} aria-hidden="true" />
            </span>
            <div>
              <strong>{selected.name}</strong>
              <span>{selected.category} · {selected.location}</span>
              <p>{selected.description}</p>
            </div>
          </article>
        ) : null}
        {results.length === 0 ? (
          <p className="map-empty">No encontramos resultados con esos filtros.</p>
        ) : null}
      </section>

      <section className="map-suggestions" aria-labelledby="map-suggestions-title">
        <div className="section-head">
          <h2 id="map-suggestions-title">Centros de apoyo</h2>
          <span className="demo-badge">Ubicación aproximada</span>
        </div>
        {SUPPORT_CENTERS.map((center) => (
          <button
            key={center.id}
            type="button"
            className="map-suggestion"
            onClick={() => {
              const result = RESULTS.find((item) => item.id === center.id);
              if (result) selectResult(result);
            }}
          >
            <span className="center-icon"><MapPin size={18} aria-hidden="true" /></span>
            <span>
              <strong>{center.name}</strong>
              <small>{center.distance} · {center.note}</small>
            </span>
          </button>
        ))}
      </section>
    </div>
  );
}
