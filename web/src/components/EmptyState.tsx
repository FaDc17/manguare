import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={26} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      {children ? <div className="empty-copy">{children}</div> : null}
    </div>
  );
}
