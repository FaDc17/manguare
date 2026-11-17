import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useApp } from '../app/AppContext';

const ICONS = {
  ok: CheckCircle2,
  warn: Info,
  error: TriangleAlert,
};

export function Toast() {
  const { toast, dismissToast } = useApp();
  if (!toast) return null;
  const Icon = ICONS[toast.tone];

  return (
    <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
      <Icon size={19} aria-hidden="true" />
      <p>{toast.message}</p>
      <button type="button" onClick={dismissToast} aria-label="Cerrar aviso">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
