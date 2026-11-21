import { lazy, Suspense } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
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
  const { t } = useTranslation();
  return (
    <Suspense fallback={<div className="map-loading">{t('map.cargandoMapa')}</div>}>
      <LocationPicker value={value} onChange={onChange} />
    </Suspense>
  );
}
