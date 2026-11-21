// Actualiza las etiquetas accesibles del zoom de Leaflet cuando cambia el idioma.

import { ZoomControl } from 'react-leaflet';
import { useTranslation } from '../i18n/LanguageContext';

export function MapZoom() {
  const { language, t } = useTranslation();
  return (
    <ZoomControl
      key={language}
      zoomInTitle={t('map.zoomIn')}
      zoomOutTitle={t('map.zoomOut')}
    />
  );
}
