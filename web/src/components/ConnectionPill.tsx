// Presenta el estado de conexión con un texto del idioma elegido.

import { useTranslation } from '../i18n/LanguageContext';
import { Wifi, WifiOff } from 'lucide-react';

export function ConnectionPill({ online }: { online: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={`conn-pill ${online ? 'is-online' : 'is-offline'}`}
      title={online ? t('connectionPill.laAppPuedeEnviarAlertas') : t('connectionPill.lasAlertasSeGuardanHastaQue')}
    >
      {online ? <Wifi size={15} aria-hidden="true" /> : <WifiOff size={15} aria-hidden="true" />}
      <span>{online ? t('connectionPill.enLinea') : t('connectionPill.sinSenal')}</span>
    </span>
  );
}
