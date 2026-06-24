interface PageLoadingProps {
    label?: string;
    spinnerClassName?: string;
}

export default function PageLoading({
    label = 'טוען...',
    spinnerClassName = 'text-success',
}: PageLoadingProps) {
    return (
        <div className="page-loading" role="status" aria-live="polite">
            <div
                className={`spinner-border page-loading__spinner ${spinnerClassName}`}
                aria-hidden="true"
            />
            <span className="visually-hidden">{label}</span>
            <p className="page-loading__label">{label}</p>
        </div>
    );
}
