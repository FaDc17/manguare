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
  return (
    <header className="subheader">
      <button type="button" className="icon-btn" onClick={onBack} aria-label="Volver">
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
