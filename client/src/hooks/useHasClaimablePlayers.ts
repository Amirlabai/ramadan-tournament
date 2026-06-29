import { useEffect, useState } from 'react';
import { teamsAPI, type TournamentSlug } from '../api/client';

export function useHasClaimablePlayers(slug: TournamentSlug = 'boys') {
    const [hasClaimablePlayers, setHasClaimablePlayers] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setHasClaimablePlayers(null);

        teamsAPI.hasClaimablePlayers(slug)
            .then((response) => {
                if (!cancelled) {
                    setHasClaimablePlayers(response.data.hasClaimablePlayers);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setHasClaimablePlayers(false);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [slug]);

    return { hasClaimablePlayers, loading };
}
