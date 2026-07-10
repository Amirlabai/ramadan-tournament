import path from 'path';

const ALLOWED_IMAGE_EXT = /^\.(jpe?g|png|webp|gif)$/i;

/** Safe image extension from upload original name; defaults to .jpg. */
export function safeImageExt(originalName?: string | null): string {
  const ext = path.extname(originalName || '').toLowerCase();
  return ALLOWED_IMAGE_EXT.test(ext) ? ext : '.jpg';
}
