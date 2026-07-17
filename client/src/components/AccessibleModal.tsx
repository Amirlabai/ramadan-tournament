import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../hooks/useFocusTrap';
import './AccessibleModal.css';

interface AccessibleModalProps {
    open: boolean;
    onClose: () => void;
    titleId: string;
    children: ReactNode;
    /** Extra class on the outer shell (backdrop + dialog). */
    className?: string;
    /** Extra class on the dialog panel — use for placement variants. */
    dialogClassName?: string;
    /** Bootstrap vertical centering. Default true; set false for bottom-anchored sheets. */
    centered?: boolean;
}

const AccessibleModal = ({
    open,
    onClose,
    titleId,
    children,
    className = '',
    dialogClassName = '',
    centered = true,
}: AccessibleModalProps) => {
    const trapRef = useFocusTrap(open, onClose);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open) return;

        const appShell = document.querySelector('.app');
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        appShell?.setAttribute('inert', '');

        return () => {
            document.body.style.overflow = previousOverflow;
            appShell?.removeAttribute('inert');
        };
    }, [open]);

    if (!open || !mounted) return null;

    const shellClass = ['modal', 'show', 'd-block', 'accessible-modal', className]
        .filter(Boolean)
        .join(' ');
    const dialogClass = [
        'modal-dialog',
        'accessible-modal__dialog',
        centered ? 'modal-dialog-centered' : '',
        dialogClassName,
    ]
        .filter(Boolean)
        .join(' ');

    return createPortal(
        <div className={shellClass}>
            <div
                className="modal-backdrop-layer accessible-modal__backdrop"
                aria-hidden="true"
                onMouseDown={(e) => {
                    if (e.target === e.currentTarget) onClose();
                }}
            />
            <div
                ref={trapRef}
                className={dialogClass}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>,
        document.body
    );
};

export default AccessibleModal;
