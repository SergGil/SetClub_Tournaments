import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Sport = 'tennis' | 'padel';

type SportContextValue = { sport: Sport; setSport: (sport: Sport) => void };

const SportContext = createContext<SportContextValue | null>(null);

/** Global tennis/padel toggle - shared by tournaments/matches/teams/randomize/rating so switching sport in one place (the Tournaments tab header) is consistent everywhere else, mirroring how the web app's tennis/padel sections are separate but a visitor picks one at a time. Not persisted across app restarts - defaults back to tennis. */
export function SportProvider({ children }: { children: ReactNode }) {
  const [sport, setSport] = useState<Sport>('tennis');
  const value = useMemo(() => ({ sport, setSport }), [sport]);
  return <SportContext.Provider value={value}>{children}</SportContext.Provider>;
}

export function useSport(): SportContextValue {
  const ctx = useContext(SportContext);
  if (!ctx) throw new Error('useSport must be used within SportProvider');
  return ctx;
}

/** `session.user.domains` uses "TENNIS"/"PADEL" (src/lib/permissions.ts's server-side enum); this maps the UI's lowercase Sport to that. */
export function sportDomain(sport: Sport): 'TENNIS' | 'PADEL' {
  return sport === 'tennis' ? 'TENNIS' : 'PADEL';
}
