import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface AccessibleModalProps {
    open: boolean;
    onClose: () => void;
    titleId: string;
    children: ReactNode;
    className?: string;
}

const AccessibleModal = ({ open, onClose, titleId, children, className = '' }: AccessibleModalProps) => {
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

    const backdropClass = `modal show d-block ${className}`.trim();

    return createPortal(
        <div className={backdropClass} style={{ position: 'fixed', inset: 0, zIndex: 1050 }}>
            <div
                className="modal-backdrop-layer"
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                }}
                aria-hidden="true"
                onMouseDown={(e) => {
                    if (e.target === e.currentTarget) onClose();
                }}
            />
            <div
                ref={trapRef}
                className="modal-dialog modal-dialog-centered"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                style={{ position: 'relative', zIndex: 1 }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>,
        document.body
    );
};

export default AccessibleModal;
