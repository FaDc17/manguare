import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LeafletMouseEvent } from 'leaflet';
import type { AlertLocation } from '../lib/types';
import 'leaflet/dist/leaflet.css';

const AMAZONAS_CENTER: [number, number] = [-5.15, -77.95];

function MapClick({ onPick }: { onPick: (event: LeafletMouseEvent) => void }) {
  useMapEvents({ click: onPick });
  return null;
}

function MapCenter({ value }: { value?: AlertLocation }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.setView([value.lat, value.lng], Math.max(map.getZoom(), 14));
  }, [map, value?.lat, value?.lng]);
  return null;
}

export function LocationPicker({
  value,
  onChange,
}: {
  value?: AlertLocation;
  onChange: (location: AlertLocation) => void;
}) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const center: [number, number] = value ? [value.lat, value.lng] : AMAZONAS_CENTER;

  const activateLocation = () => {
    if (!navigator.geolocation) {
      setError('Este navegador no ofrece geolocalización.');
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy),
          capturedAt: new Date(position.timestamp).toISOString(),
        });
        setLocating(false);
      },
      () => {
        setError('No se pudo obtener el GPS. Puedes tocar el mapa para ajustar el punto.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  return (
    <div className="location-picker">
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={activateLocation}
        disabled={locating}
      >
        {locating ? 'Buscando ubicación…' : 'Activar mi ubicación'}
      </button>
      <MapContainer
        className="location-picker-map"
        center={center}
        zoom={value ? 14 : 8}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClick
          onPick={(event) =>
            onChange({
              lat: Number(event.latlng.lat.toFixed(6)),
              lng: Number(event.latlng.lng.toFixed(6)),
              accuracy: 0,
              capturedAt: new Date().toISOString(),
            })
          }
        />
        <MapCenter value={value} />
        {value ? (
          <CircleMarker center={[value.lat, value.lng]} radius={9} pathOptions={{ color: '#1e684f' }}>
            <></>
          </CircleMarker>
        ) : null}
      </MapContainer>
      <p className="map-helper">
        {value
          ? 'Punto elegido. Toca otra parte del mapa para ajustarlo.'
          : 'Toca el mapa para elegir una ubicación aproximada.'}
      </p>
      {error ? <p className="field-error" role="status">{error}</p> : null}
    </div>
  );
}
