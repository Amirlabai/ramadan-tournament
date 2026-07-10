import { useRef, useState } from 'react';
import AccessibleModal from '../AccessibleModal';
import { teamsAPI, type TournamentSlug } from '../../api/client';
import { displayNickname, fullName } from '../../utils/playerDisplayName';
import type { Player } from '../../types';

const POSITIONS = ['שוער', 'בלם', 'מגן', 'קשר', 'חלוץ'];

interface Props {
  open: boolean;
  onClose: () => void;
  teamId: number;
  player: Player;
  slug: TournamentSlug;
  onSaved: () => void;
}

export default function RosterPlayerEditModal({
  open,
  onClose,
  teamId,
  player,
  slug,
  onSaved,
}: Props) {
  const [form, setForm] = useState({
    firstName: player.firstName ?? '',
    lastName: player.lastName ?? '',
    nickname: player.nickname ?? '',
    number: String(player.number ?? ''),
    position: player.position ?? '',
    bio: player.bio ?? '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleId = `roster-edit-${player.memberId}`;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('שם פרטי ושם משפחה הם שדות חובה');
      return;
    }
    const number = Number(form.number);
    if (!Number.isInteger(number) || number < 1 || number > 99) {
      setError('מספר חולצה חייב להיות בין 1 ל־99');
      return;
    }
    setSaving(true);
    try {
      const lastName = form.lastName.trim();
      await teamsAPI.updateManagedPlayer(
        teamId,
        player.memberId,
        {
          firstName: form.firstName.trim(),
          lastName,
          nickname: form.nickname.trim(),
          number,
          position: form.position,
          bio: form.bio,
        },
        slug
      );
      onSaved();
      onClose();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || 'שגיאה בשמירת פרטי השחקן');
    } finally {
      setSaving(false);
    }
  };

  const handlePhoto = async (file: File | null) => {
    if (!file) return;
    setPhotoBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('photo', file);
      await teamsAPI.uploadManagedPlayerPhoto(teamId, player.memberId, fd, slug);
      onSaved();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || 'שגיאה בהעלאת תמונה');
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDeletePhoto = async () => {
    setPhotoBusy(true);
    setError('');
    try {
      await teamsAPI.deleteManagedPlayerPhoto(teamId, player.memberId, slug);
      onSaved();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || 'שגיאה במחיקת תמונה');
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <AccessibleModal open={open} onClose={onClose} titleId={titleId}>
      <div className="modal-content">
        <div className="modal-header">
          <h2 id={titleId} className="modal-title h5">
            עריכת שחקן — {displayNickname(player) || fullName(player)}
          </h2>
          <button type="button" className="btn-close" onClick={onClose} aria-label="סגור" />
        </div>
        <form onSubmit={(e) => void handleSave(e)} className="modal-body">
          <p className="small text-muted">
            עריכת בעלים/קפטן — דורסת את פרטי השחקן בסגל (השחקן יכול לערוך שוב בפרופיל).
          </p>
          <div className="row g-3">
            <div className="col-6">
              <label htmlFor={`${titleId}-first`} className="form-label">
                שם פרטי *
              </label>
              <input
                id={`${titleId}-first`}
                className="form-control"
                value={form.firstName}
                maxLength={50}
                required
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
              />
            </div>
            <div className="col-6">
              <label htmlFor={`${titleId}-last`} className="form-label">
                שם משפחה *
              </label>
              <input
                id={`${titleId}-last`}
                className="form-control"
                value={form.lastName}
                maxLength={50}
                required
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
              />
            </div>
            <div className="col-6">
              <label htmlFor={`${titleId}-nick`} className="form-label">
                כינוי (ריק = שם משפחה)
              </label>
              <input
                id={`${titleId}-nick`}
                className="form-control"
                value={form.nickname}
                maxLength={50}
                onChange={(e) => setForm((p) => ({ ...p, nickname: e.target.value }))}
              />
            </div>
            <div className="col-3">
              <label htmlFor={`${titleId}-num`} className="form-label">
                מספר *
              </label>
              <input
                id={`${titleId}-num`}
                type="number"
                className="form-control"
                value={form.number}
                min={1}
                max={99}
                required
                onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))}
              />
            </div>
            <div className="col-3">
              <label htmlFor={`${titleId}-pos`} className="form-label">
                עמדה
              </label>
              <select
                id={`${titleId}-pos`}
                className="form-select"
                value={form.position}
                onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))}
              >
                <option value="">—</option>
                {POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12">
              <label htmlFor={`${titleId}-bio`} className="form-label">
                ביוגרפיה
              </label>
              <textarea
                id={`${titleId}-bio`}
                className="form-control"
                rows={2}
                maxLength={300}
                value={form.bio}
                onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
              />
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor={`${titleId}-photo`}>
                תמונת ראש
              </label>
              <input
                id={`${titleId}-photo`}
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="form-control"
                disabled={photoBusy}
                onChange={(e) => void handlePhoto(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className="btn btn-sm btn-outline-danger mt-2"
                disabled={photoBusy}
                onClick={() => void handleDeletePhoto()}
              >
                מחק תמונה
              </button>
            </div>
          </div>
          {error && (
            <div className="alert alert-danger py-2 mt-3" role="alert">
              {error}
            </div>
          )}
          <div className="d-flex gap-2 mt-3">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              ביטול
            </button>
            <button type="submit" className="btn btn-theme-green ms-auto" disabled={saving || photoBusy}>
              {saving ? 'שומר…' : 'שמור'}
            </button>
          </div>
        </form>
      </div>
    </AccessibleModal>
  );
}
