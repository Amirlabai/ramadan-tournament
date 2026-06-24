import { useState } from 'react';
import { usersAPI, type TournamentSlug } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export function useCancelRegistrationRequest(slug: TournamentSlug) {
    const { refreshUser } = useAuth();
    const [cancelling, setCancelling] = useState(false);

    const cancelRegistrationRequest = async (
        confirmMessage = 'לבטל את הבקשה הפעילה?'
    ): Promise<{ ok: boolean; error?: string }> => {
        if (!confirm(confirmMessage)) {
            return { ok: false };
        }
        setCancelling(true);
        try {
            await usersAPI.cancelRegistrationRequest(slug);
            await refreshUser();
            return { ok: true };
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { error?: string } } };
            return { ok: false, error: ax.response?.data?.error || 'שגיאה בביטול הבקשה' };
        } finally {
            setCancelling(false);
        }
    };

    return { cancelRegistrationRequest, cancelling };
}
