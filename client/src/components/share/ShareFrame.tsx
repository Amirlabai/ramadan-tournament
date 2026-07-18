import { forwardRef, type ReactNode } from 'react';
import { siteBrandLabel } from '../../utils/tournamentPaths';

type ShareFrameProps = {
  children: ReactNode;
};

export const ShareFrame = forwardRef<HTMLDivElement, ShareFrameProps>(
  function ShareFrame({ children }, ref) {
    return (
      <div ref={ref} className="share-frame" dir="rtl" lang="he" aria-hidden="true">
        <div className="share-frame__wash" />
        <div className="share-frame__content">{children}</div>
        <footer className="share-frame__footer">
          <span>{siteBrandLabel()}</span>
        </footer>
      </div>
    );
  }
);
