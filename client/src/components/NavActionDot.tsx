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
    external?: boolean;
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
    external = false,
}: NavActionLinkProps) {
    const handleClick = () => {
        if (trackNav) {
            trackEvent('nav_click', {
                category: 'browse',
                properties: { navTo: to, external },
            });
        }
        onClick?.();
    };

    const linkClass = navLinkWithDotClass(className, showActionDot, [active && 'active', extraClassName].filter(Boolean).join(' '));
    const ariaLabel = external
        ? `${withPendingActionLabel(label, showActionDot)} (נפתח בחלון חדש)`
        : navLinkActionAriaLabel(label, showActionDot);

    if (external) {
        return (
            <a
                href={to}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
                aria-label={ariaLabel}
                onClick={handleClick}
            >
                {label}
                {showActionDot && <NavActionDot />}
            </a>
        );
    }

    return (
        <Link
            to={to}
            className={linkClass}
            aria-current={active ? 'page' : undefined}
            aria-label={ariaLabel}
            onClick={handleClick}
        >
            {label}
            {showActionDot && <NavActionDot />}
        </Link>
    );
}
