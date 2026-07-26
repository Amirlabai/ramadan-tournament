import fs from 'fs';
import path from 'path';

export type UploadSubdir = 'logos' | 'players' | 'banners';

export const UPLOADS_DISK_MISCONFIG_MESSAGE =
  'UPLOADS_DISK_PATH is required in production (Render persistent disk). Uploads are disabled until it is set.';

function isProduction(): boolean {
  return (process.env.NODE_ENV || 'development') === 'production';
}

export function repoUploadsRoot(): string {
  return path.join(process.cwd(), 'uploads');
}

/**
 * Persistent write root. In production, UPLOADS_DISK_PATH must be set (no silent
 * fallback to cwd). In non-production, falls back to the repo uploads tree.
 */
export function diskUploadsRoot(): string {
  const configured = (process.env.UPLOADS_DISK_PATH || '').trim();
  if (configured) return path.resolve(configured);
  if (isProduction()) {
    throw new Error(UPLOADS_DISK_MISCONFIG_MESSAGE);
  }
  return repoUploadsRoot();
}

export function hasSeparateDiskUploads(): boolean {
  try {
    return path.resolve(diskUploadsRoot()) !== path.resolve(repoUploadsRoot());
  } catch {
    return false;
  }
}

/** True when production is missing UPLOADS_DISK_PATH (uploads must be rejected). */
export function isUploadsDiskMisconfigured(): boolean {
  if (!isProduction()) return false;
  return !(process.env.UPLOADS_DISK_PATH || '').trim();
}

export function assertUploadsWritable(): void {
  if (isUploadsDiskMisconfigured()) {
    console.error(UPLOADS_DISK_MISCONFIG_MESSAGE);
    throw new Error(UPLOADS_DISK_MISCONFIG_MESSAGE);
  }
}

export function uploadWriteDir(subdir: UploadSubdir): string {
  assertUploadsWritable();
  const dir = path.join(diskUploadsRoot(), subdir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function resolveUnderRoot(root: string, publicOrRelativePath: string): string | null {
  const trimmed = publicOrRelativePath.trim();
  if (!trimmed.startsWith('/uploads/') && !trimmed.startsWith('uploads/')) return null;
  const underUploads = trimmed.replace(/^\/?uploads\/?/, '');
  if (!underUploads || underUploads.includes('..')) return null;
  const full = path.resolve(root, underUploads);
  const rootResolved = path.resolve(root);
  if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) return null;
  return full;
}

/** Public URL path like `/uploads/logos/x.jpg` or relative `uploads/...`. */
export function unlinkUpload(publicOrRelativePath?: string | null): void {
  if (!publicOrRelativePath) return;

  const roots = [repoUploadsRoot()];
  try {
    const disk = diskUploadsRoot();
    if (path.resolve(disk) !== path.resolve(repoUploadsRoot())) {
      roots.push(disk);
    }
  } catch {
    // Production without disk: still try repo root only.
  }

  for (const root of roots) {
    const full = resolveUnderRoot(root, publicOrRelativePath);
    if (!full) continue;
    try {
      if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch (err) {
      console.error('Failed to delete upload file:', full, err);
    }
  }
}

export function publicUploadUrl(subdir: UploadSubdir, fileName: string): string {
  return `/uploads/${subdir}/${fileName}`;
}
