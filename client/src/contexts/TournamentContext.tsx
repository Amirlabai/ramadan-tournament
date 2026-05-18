import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/client';
import {
  homePathForSlug,
  readPreferredTournament,
  slugFromPathname,
  tournamentPaths,
  writePreferredTournament,
  type TournamentSlug,
} from '../utils/tournamentPaths';

export interface ActiveSeason {
  seasonId: string;
  yearMonth: string;
  division: string;
  scoringMode: string;
  displayName: string;
  isActive: boolean;
}

interface TournamentContextValue {
  slug: TournamentSlug;
  paths: (typeof tournamentPaths)[TournamentSlug];
  season: ActiveSeason | null;
  seasonLoading: boolean;
  seasonError: string | null;
  switchTournament: (target: TournamentSlug) => void;
  isGirls: boolean;
}

const TournamentContext = createContext<TournamentContextValue | null>(null);

export function TournamentProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const slug = slugFromPathname(location.pathname);
  const paths = tournamentPaths[slug];
  const [season, setSeason] = useState<ActiveSeason | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(true);
  const [seasonError, setSeasonError] = useState<string | null>(null);

  const loadSeason = useCallback(async (division: TournamentSlug) => {
    setSeasonLoading(true);
    setSeasonError(null);
    try {
      const res = await api.get<ActiveSeason>('/seasons/active', {
        params: { division },
      });
      setSeason(res.data);
    } catch {
      setSeason(null);
      setSeasonError(
        division === 'girls'
          ? 'אין עונה פעילה לטורניר בנות. פנה למנהל להפעלת העונה.'
          : 'לא נמצאה עונה פעילה לטורניר כדורגל.'
      );
    } finally {
      setSeasonLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSeason(slug);
  }, [slug, loadSeason]);

  const switchTournament = useCallback(
    (target: TournamentSlug) => {
      writePreferredTournament(target);
      navigate(homePathForSlug(target));
    },
    [navigate]
  );

  const value = useMemo(
    () => ({
      slug,
      paths,
      season,
      seasonLoading,
      seasonError,
      switchTournament,
      isGirls: slug === 'girls',
    }),
    [slug, paths, season, seasonLoading, seasonError, switchTournament]
  );

  return (
    <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>
  );
}

export function useTournament(): TournamentContextValue {
  const ctx = useContext(TournamentContext);
  if (!ctx) {
    throw new Error('useTournament must be used within TournamentProvider');
  }
  return ctx;
}

/** Redirect returning visitors to their last tournament when landing on boys home only. */
export function TournamentPreferenceRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname !== '/') return;
    const preferred = readPreferredTournament();
    if (preferred === 'girls') {
      navigate('/girls', { replace: true });
    }
  }, [location.pathname, navigate]);

  return null;
}
