import type { Express, RequestHandler } from 'express';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { diskUploadsRoot, hasSeparateDiskUploads, repoUploadsRoot } from './uploadPaths';

/**
 * Serve a file from `root` only when it exists and size > 0.
 * Empty/placeholder repo files fall through so a disk copy can win.
 */
export function serveNonEmptyUploads(root: string): RequestHandler {
  const rootResolved = path.resolve(root);
  return (req, res, next) => {
    const relative = decodeURIComponent((req.path || '').replace(/^\/+/, ''));
    if (!relative || relative.includes('..')) {
      next();
      return;
    }
    const full = path.resolve(rootResolved, relative);
    if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) {
      next();
      return;
    }
    try {
      const st = fs.statSync(full);
      if (st.isFile() && st.size > 0) {
        res.sendFile(full);
        return;
      }
    } catch {
      /* miss → next */
    }
    next();
  };
}

/** Mount /uploads: prefer non-empty repo files, then persistent disk when configured. */
export function mountUploadsStatic(app: Express): void {
  const repoRoot = repoUploadsRoot();
  app.use('/uploads', serveNonEmptyUploads(repoRoot));

  if (!hasSeparateDiskUploads()) {
    // Single-root (local): size>0 gate above is enough; do not remount plain static
    // (that would serve empty placeholders).
    return;
  }

  try {
    const diskRoot = diskUploadsRoot();
    if (!fs.existsSync(diskRoot)) {
      fs.mkdirSync(diskRoot, { recursive: true });
    }
    app.use('/uploads', express.static(diskRoot));
  } catch (err) {
    console.error('Failed to mount UPLOADS_DISK_PATH static:', err);
  }
}
