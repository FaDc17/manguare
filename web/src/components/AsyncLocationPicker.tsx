import { lazy, Suspense } from 'react';
import type { AlertLocation } from '../lib/types';

const LocationPicker = lazy(() =>
  import('./LocationPicker').then((module) => ({ default: module.LocationPicker })),
);

/**
 * Carga Leaflet solo cuando se abre el selector de mapa. Así el mapa no pesa
 * en la pantalla de inicio ni en el arranque de la PWA.
 */
export function AsyncLocationPicker({
  value,
  onChange,
}: {
  value?: AlertLocation;
  onChange: (location: AlertLocation) => void;
}) {
  return (
    <Suspense fallback={<div className="map-loading">Cargando mapa…</div>}>
      <LocationPicker value={value} onChange={onChange} />
    </Suspense>
  );
}
