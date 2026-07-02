import { Link } from 'react-router-dom';
import { trackEvent } from '../utils/analytics';
import './NavActionDot.css';

export default function NavActionDot() {
    return <span className="nav-action-dot" aria-hidden="true" />;
}

export function withPendingActionLabel(label: string, hasAction: boolean): string {
    return hasAction ? `${label} — יש פעולות ממתינות` : label;
}

export function navLinkWithDotClass(baseClass: string, showActionDot: boolean, extra = ''): string {
    return [baseClass, showActionDot && `${baseClass}--has-dot`, extra].filter(Boolean).join(' ');
}

export function navLinkActionAriaLabel(label: string, showActionDot: boolean): string | undefined {
    return showActionDot ? withPendingActionLabel(label, true) : undefined;
}

interface NavActionLinkProps {
    to: string;
    label: string;
    showActionDot?: boolean;
    className?: string;
    active?: boolean;
    extraClassName?: string;
    onClick?: () => void;
    trackNav?: boolean;
}

export function NavActionLink({
    to,
    label,
    showActionDot = false,
    className = 'footer-link',
    active = false,
    extraClassName = '',
    onClick,
    trackNav = false,
}: NavActionLinkProps) {
    const handleClick = () => {
        if (trackNav) {
            trackEvent('nav_click', {
                category: 'browse',
                properties: { navTo: to },
            });
        }
        onClick?.();
    };

    return (
        <Link
            to={to}
            className={navLinkWithDotClass(className, showActionDot, [active && 'active', extraClassName].filter(Boolean).join(' '))}
            aria-current={active ? 'page' : undefined}
            aria-label={navLinkActionAriaLabel(label, showActionDot)}
            onClick={handleClick}
        >
            {label}
            {showActionDot && <NavActionDot />}
        </Link>
    );
}
