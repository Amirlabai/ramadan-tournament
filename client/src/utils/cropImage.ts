import type { Area } from 'react-easy-crop';

/** Export cropped region as JPEG blob, scaled to at most maxWidth × maxHeight. */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  maxWidth = 1080,
  maxHeight = 270
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, maxWidth / pixelCrop.width, maxHeight / pixelCrop.height);
  const outW = Math.max(1, Math.round(pixelCrop.width * scale));
  const outH = Math.max(1, Math.round(pixelCrop.height * scale));
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas unsupported');
  }

  // With Cropper restrictPosition={false} + zoom < 1, crop can leave the media.
  // Fill letterbox margins, then draw only the overlapping source rect.
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, outW, outH);

  const scaleX = outW / pixelCrop.width;
  const scaleY = outH / pixelCrop.height;
  const sx = Math.max(0, pixelCrop.x);
  const sy = Math.max(0, pixelCrop.y);
  const ex = Math.min(image.naturalWidth, pixelCrop.x + pixelCrop.width);
  const ey = Math.min(image.naturalHeight, pixelCrop.y + pixelCrop.height);
  if (ex > sx && ey > sy) {
    const sw = ex - sx;
    const sh = ey - sy;
    ctx.drawImage(
      image,
      sx,
      sy,
      sw,
      sh,
      (sx - pixelCrop.x) * scaleX,
      (sy - pixelCrop.y) * scaleY,
      sw * scaleX,
      sh * scaleY
    );
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Crop export failed'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.92
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', () => reject(new Error('Image load failed')));
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}
