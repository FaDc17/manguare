import { createContext, useContext, type ReactNode } from 'react';
import type { Session } from '../lib/session';

interface SessionContextValue {
  session: Session;
  logout: () => void;
  updateName: (name: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  session,
  logout,
  updateName,
  children,
}: SessionContextValue & { children: ReactNode }) {
  return (
    <SessionContext.Provider value={{ session, logout, updateName }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession debe usarse dentro de SessionProvider');
  return value;
}
