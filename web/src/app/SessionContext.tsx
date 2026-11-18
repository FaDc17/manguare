import { createContext, useContext, type ReactNode } from 'react';
import type { Session } from '../lib/session';

interface SessionContextValue {
  session: Session;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  session,
  logout,
  children,
}: SessionContextValue & { children: ReactNode }) {
  return (
    <SessionContext.Provider value={{ session, logout }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession debe usarse dentro de SessionProvider');
  return value;
}
