import { useEffect, useId, useRef, useState } from 'react';
import { useTournament } from '../contexts/TournamentContext';
import { tournamentPaths, type TournamentSlug } from '../utils/tournamentPaths';
import './TournamentSwitcher.css';

const TournamentSwitcher = () => {
  const { slug, switchTournament } = useTournament();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const currentLabel = tournamentPaths[slug].label;

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const onSelect = (target: TournamentSlug) => {
    setOpen(false);
    if (target !== slug) switchTournament(target);
  };

  return (
    <div className="tournament-switcher-wrap" ref={containerRef}>
      <button
        type="button"
        className="tournament-switcher-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label="בחירת טורניר"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="tournament-switcher-label">{currentLabel}</span>
        <span className="tournament-switcher-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <ul id={listId} className="tournament-switcher-menu" role="listbox" aria-label="רשימת טורנירים">
          {(Object.keys(tournamentPaths) as TournamentSlug[]).map((key) => (
            <li key={key} role="option" aria-selected={key === slug}>
              <button
                type="button"
                className={`tournament-switcher-option${key === slug ? ' active' : ''}`}
                onClick={() => onSelect(key)}
              >
                {tournamentPaths[key].label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TournamentSwitcher;
