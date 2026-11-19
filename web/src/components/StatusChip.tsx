// Convierte el estado interno de una alerta en una etiqueta visible.

import { CheckCircle2, Clock3, Send, XCircle } from 'lucide-react';
import type { AlertState } from '../lib/types';
import { useTranslation } from '../i18n/LanguageContext';

const ICONS = {
  pending: Clock3,
  sent: Send,
  received: CheckCircle2,
  canceled: XCircle,
};

export function StatusChip({
  state,
  compact = false,
  label,
}: {
  state: AlertState;
  compact?: boolean;
  label?: string;
}) {
  const { t } = useTranslation();
  const Icon = ICONS[state];
  return (
    <span className={`status-chip status-${state} ${compact ? 'is-compact' : ''}`}>
      <Icon size={compact ? 13 : 14} aria-hidden="true" />
      {label ?? t(`status.${state}`)}
    </span>
  );
}
