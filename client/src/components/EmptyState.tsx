interface EmptyStateProps {
    message: string;
    title?: string;
}

export default function EmptyState({ message, title }: EmptyStateProps) {
    return (
        <div className="empty-state" role="status">
            {title ? <p className="empty-state__title">{title}</p> : null}
            <p className="empty-state__message">{message}</p>
        </div>
    );
}
