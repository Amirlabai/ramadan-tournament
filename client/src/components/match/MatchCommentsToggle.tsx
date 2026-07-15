import type { MatchDisplayStatus } from './MatchCardParts';

type MatchCommentsToggleProps = {
  expanded: boolean;
  status: MatchDisplayStatus;
  commentCount?: number;
  controlsId: string;
  onClick: () => void;
};

export function MatchCommentsToggle({
  expanded,
  status,
  commentCount,
  controlsId,
  onClick,
}: MatchCommentsToggleProps) {
  const hasComments = (commentCount ?? 0) > 0;
  const commentsOnly = status === 'upcoming';

  return (
    <button
      type="button"
      className="btn-comments"
      aria-expanded={expanded}
      aria-controls={controlsId}
      onClick={onClick}
    >
      {expanded ? (
        commentsOnly ? 'הסתר תגובות' : 'הסתר פרטים'
      ) : commentsOnly ? (
        hasComments ? (
          <>
            תגובות
            <span className="badge bg-danger ms-2 rounded-pill">{commentCount}</span>
          </>
        ) : (
          'הוסף תגובה'
        )
      ) : (
        <>
          פרטים
          {hasComments ? (
            <span className="badge bg-danger ms-2 rounded-pill">{commentCount}</span>
          ) : null}
        </>
      )}
    </button>
  );
}
