// Muestra los contactos de ayuda y sus etiquetas localizadas.

import { useTranslation } from '../i18n/LanguageContext';
import { Phone, Radio } from 'lucide-react';
import { useApp } from '../app/AppContext';
import { Sheet } from './Sheet';
import { HELP_CONTACTS } from '../lib/help-contacts';


export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { settings } = useApp();
  const healthPost = settings.healthPost.trim();
  const healthPhone = settings.healthPhone.trim();

  return (
    <Sheet open={open} title={t('helpSheet.numerosDeAyuda')} onClose={onClose}>
      <p className="sheet-intro">
        {healthPost ? t('helpSheet.tuPuestoDeSalud', { healthPost }) : ''}
        {t('helpSheet.estosNumerosNecesitanSenalTelefonicaSi')}
      </p>
      <div className="help-list">
        {healthPhone ? (
          <a className="help-item" href={`tel:${healthPhone.replace(/[^\d+*#]/g, '')}`}>
            <span className="help-icon">
              <Phone size={19} aria-hidden="true" />
            </span>
            <span className="help-copy">
              <span className="help-label">{t('helpSheet.puestoDeSalud')}</span>
              <span className="help-detail">{healthPost || t('helpSheet.contactoDeLaComunidad')}</span>
            </span>
            <span className="help-number">{healthPhone}</span>
          </a>
        ) : null}
        {HELP_CONTACTS.map((item) => (
          <a key={item.number} className="help-item" href={`tel:${item.number}`}>
            <span className="help-icon">
              <Phone size={19} aria-hidden="true" />
            </span>
            <span className="help-copy">
              <span className="help-label">{t(item.label)}</span>
              <span className="help-detail">{t(item.detail)}</span>
            </span>
            <span className="help-number">{item.number}</span>
          </a>
        ))}
      </div>
      <div className="notice-box">
        <strong>{t('helpSheet.manguareComplementaNoReemplaza')}</strong>
        <p>
          {t('helpSheet.manguareNoEsUnServicioDe')}
        </p>
      </div>
      <p className="sheet-footnote">
        <Radio size={15} aria-hidden="true" />{' '}{t('helpSheet.enZonasSinSenalLaRadio')}
      </p>
    </Sheet>
  );
}
