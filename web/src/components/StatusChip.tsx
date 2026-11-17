import { CheckCircle2, Clock3, Send, XCircle } from 'lucide-react';
import type { AlertState } from '../lib/types';
import { STATE_LABEL } from '../lib/format';

const ICONS = {
  pending: Clock3,
  sent: Send,
  received: CheckCircle2,
  canceled: XCircle,
};

export function StatusChip({ state, compact = false }: { state: AlertState; compact?: boolean }) {
  const Icon = ICONS[state];
  return (
    <span className={`status-chip status-${state} ${compact ? 'is-compact' : ''}`}>
      <Icon size={compact ? 13 : 14} aria-hidden="true" />
      {STATE_LABEL[state]}
    </span>
  );
}
