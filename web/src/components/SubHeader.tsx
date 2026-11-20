// Presenta el encabezado de pantalla y la etiqueta accesible para volver.

import { useTranslation } from '../i18n/LanguageContext';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export function SubHeader({
  title,
  onBack,
  right,
  subtitle,
}: {
  title: string;
  onBack: () => void;
  right?: ReactNode;
  subtitle?: string;
}) {
  const { t } = useTranslation();
  return (
    <header className="subheader">
      <button type="button" className="icon-btn" onClick={onBack} aria-label={t('common.back')}>
        <ArrowLeft size={22} aria-hidden="true" />
      </button>
      <div className="subheader-copy">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="subheader-right">{right}</div>
    </header>
  );
}
