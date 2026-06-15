import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTournament } from '../contexts/TournamentContext';
import {
  availableTournamentSlugs,
  tournamentPaths,
  type TournamentSlug,
} from '../utils/tournamentPaths';
import './TournamentSwitcher.css';

const TournamentSwitcher = () => {
  const { slug, switchTournament } = useTournament();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const currentLabel = tournamentPaths[slug].label;
  const options = availableTournamentSlugs();

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>('button');
    first?.focus();
  }, [open]);

  useEffect(() => {
    if (open) return;
    triggerRef.current?.focus();
  }, [open]);

  const onMenuKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>('button');
    if (!buttons?.length) return;
    const list = Array.from(buttons);
    const idx = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      list[(idx + 1) % list.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      list[(idx - 1 + list.length) % list.length].focus();
    }
  };

  const onSelect = (target: TournamentSlug) => {
    setOpen(false);
    if (target !== slug) switchTournament(target);
  };

  return (
    <div className="tournament-switcher-wrap" ref={containerRef}>
      <button
        ref={triggerRef}
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
        <ul
          id={listId}
          ref={menuRef}
          className="tournament-switcher-menu"
          role="listbox"
          aria-label="רשימת טורנירים"
          onKeyDown={onMenuKeyDown}
        >
          {options.map((key) => (
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
