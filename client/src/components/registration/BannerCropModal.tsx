import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import AccessibleModal from '../AccessibleModal';
import { getCroppedImg } from '../../utils/cropImage';
import './BannerCropModal.css';

const ASPECT = 4;
const TITLE_ID = 'banner-crop-title';
/** Allow zooming out past cover so small images can sit inset in the 4:1 frame. */
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;

interface Props {
  open: boolean;
  imageSrc: string;
  onClose: () => void;
  onConfirm: (blob: Blob) => void | Promise<void>;
}

export default function BannerCropModal({ open, imageSrc, onClose, onConfirm }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    setError('');
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, 1080, 270);
      await onConfirm(blob);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || 'לא ניתן לשמור את הבאנר. נסו שוב.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccessibleModal
      open={open}
      onClose={handleClose}
      titleId={TITLE_ID}
      dialogClassName="modal-lg banner-crop-modal__dialog"
    >
      <div className="modal-content banner-crop-modal">
        <div className="modal-header">
          <h2 className="modal-title h5 mb-0" id={TITLE_ID}>
            חיתוך באנר הקבוצה
          </h2>
          <button
            type="button"
            className="btn-close"
            aria-label="סגור"
            onClick={handleClose}
            disabled={saving}
          />
        </div>
        <div className="modal-body">
          <p className="small text-muted mb-2">
            גררו למרכז והתקרבו או התרחקו עם המחוון. יחס קבוע 4:1.
          </p>
          <div className="banner-crop-modal__stage">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              aspect={ASPECT}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
              // Needed with minZoom < 1 so letterbox inset reaches croppedAreaPixels.
              restrictPosition={false}
            />
          </div>
          <label className="form-label mt-3 mb-1" htmlFor="banner-crop-zoom">
            זום
          </label>
          <input
            id="banner-crop-zoom"
            type="range"
            className="form-range banner-crop-modal__zoom"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={saving}
          />
          {error ? (
            <div className="alert alert-danger py-2 mt-2 mb-0" role="alert">
              {error}
            </div>
          ) : null}
        </div>
        <div className="modal-footer gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={handleClose}
            disabled={saving}
          >
            ביטול
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={() => void handleConfirm()}
            disabled={saving || !croppedAreaPixels}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                שומר…
              </>
            ) : (
              'שמירה'
            )}
          </button>
        </div>
      </div>
    </AccessibleModal>
  );
}
