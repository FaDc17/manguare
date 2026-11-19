// Presenta el tipo, el estado y la fecha de la alerta en el idioma activo.

import { LocalizedText, useTranslation } from '../i18n/LanguageContext';
import { ChevronRight, Image as ImageIcon, MapPin, TriangleAlert } from 'lucide-react';
import { EMERGENCY_META } from '../lib/emergency';
import { formatRelative } from '../lib/format';
import { isOverdue } from '../lib/sla';
import type { AlertRecord } from '../lib/types';
import { StatusChip } from './StatusChip';

export function AlertCard({
  alert,
  onOpen,
}: {
  alert: AlertRecord;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const meta = EMERGENCY_META[alert.type];
  const Icon = meta.icon;

  return (
    <button
      type="button"
      className="alert-card"
      data-testid={`alert-${alert.id}`}
      onClick={() => onOpen(alert.id)}
    >
      <span className={`type-tile type-tile--${meta.tone}`}>
        <Icon size={23} aria-hidden="true" />
      </span>
      <span className="alert-main">
        <span className="alert-title">
          <LocalizedText id={`emergency.${alert.type}`} />
          {alert.community ? <span className="alert-community"> · {alert.community}</span> : null}
        </span>
        <span className="alert-meta">
          {formatRelative(alert.createdAt, t)}
          {alert.location ? (
            <span className="alert-flag">
              <MapPin size={12} aria-hidden="true" /> GPS
            </span>
          ) : null}
          {alert.photo ? (
            <span className="alert-flag">
              <ImageIcon size={12} aria-hidden="true" />{' '}{t('common.photo')}
            </span>
          ) : null}
          {isOverdue(alert) ? (
            <span className="alert-flag alert-flag--overdue">
              <TriangleAlert size={12} aria-hidden="true" />{' '}{t('alertCard.plazoVencido')}
            </span>
          ) : null}
        </span>
      </span>
      <StatusChip
        state={alert.state}
        compact
        label={alert.isSos && alert.state === 'received' ? t('status.read') : undefined}
      />
      <ChevronRight size={18} className="alert-chevron" aria-hidden="true" />
    </button>
  );
}
