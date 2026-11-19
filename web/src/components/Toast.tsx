// Traduce los avisos que llegan como claves y muestra el texto que llega ya preparado.

import { useTranslation } from '../i18n/LanguageContext';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useApp } from '../app/AppContext';

const ICONS = {
  ok: CheckCircle2,
  warn: Info,
  error: TriangleAlert,
};

export function Toast({ behindSheet = false }: { behindSheet?: boolean }) {
  const { t } = useTranslation();
  const { toast, dismissToast } = useApp();
  if (!toast) return null;
  const Icon = ICONS[toast.tone];

  return (
    <div className={`toast toast-${toast.tone}${behindSheet ? ' toast-behind-sheet' : ''}`} role="status" aria-live="polite">
      <Icon size={19} aria-hidden="true" />
      <p>{typeof toast.message === 'string' ? toast.message : t(toast.message.key, toast.message.values)}</p>
      <button type="button" onClick={dismissToast} aria-label={t('common.closeNotice')}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
