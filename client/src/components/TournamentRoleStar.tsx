import type { RoleStarVariant } from '../utils/tournamentUser';
import './TournamentRoleStar.css';

const ROLE_LABELS: Record<Exclude<RoleStarVariant, null>, string> = {
    captain: 'קפטן',
    'owner-captain': 'בעלים וקפטן',
    'owner-only': 'בעלים',
};

const STAR_CLASS: Record<Exclude<RoleStarVariant, null>, string> = {
    captain: 'tournament-role-star--captain',
    'owner-captain': 'tournament-role-star--owner-captain',
    'owner-only': 'tournament-role-star--owner-only',
};

type Props = {
    variant: Exclude<RoleStarVariant, null>;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    decorative?: boolean;
};

export default function TournamentRoleStar({
    variant,
    showLabel = false,
    size = 'md',
    className = '',
    decorative = false,
}: Props) {
    const label = ROLE_LABELS[variant];
    const starClass = `tournament-role-star tournament-role-star--${size} ${STAR_CLASS[variant]} ${className}`.trim();

    if (showLabel) {
        const badgeClass =
            variant === 'owner-only'
                ? 'badge tournament-role-badge--owner-only'
                : variant === 'owner-captain'
                  ? 'badge tournament-role-badge--owner-captain'
                  : 'badge tournament-role-badge--captain';

        return (
            <span className={`${badgeClass} d-inline-flex align-items-center gap-1`}>
                <i className={`fa-solid fa-star ${starClass}`} aria-hidden="true" />
                {label}
            </span>
        );
    }

    return (
        <i
            className={`fa-solid fa-star ${starClass}`}
            aria-hidden={decorative ? true : undefined}
            aria-label={decorative ? undefined : label}
            title={label}
        />
    );
}
