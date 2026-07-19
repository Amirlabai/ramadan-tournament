import type { Express, RequestHandler } from 'express';
import express from 'express';
import fs from 'fs';
import path from 'path';
import {
  checkCompressLock,
  healOrphanCompressBak,
  isCompressSidecarName,
} from './imageCompress';
import { diskUploadsRoot, hasSeparateDiskUploads, repoUploadsRoot } from './uploadPaths';

/**
 * Serve a file from `root` only when it exists, size > 0, and not compress-locked.
 * Empty/placeholder, sidecars, or locked repo files fall through so a disk copy can win.
 * Orphan `.rt-compress-bak` is renamed back onto the public path before serving.
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
      if (isCompressSidecarName(path.basename(full))) {
        next();
        return;
      }
      if (checkCompressLock(full)) {
        next();
        return;
      }
      healOrphanCompressBak(full);
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

/** Disk static that skips compress sidecars / locks; heals orphan bak first. */
export function serveDiskUploads(root: string): RequestHandler {
  const staticMw = express.static(root);
  const rootResolved = path.resolve(root);
  return (req, res, next) => {
    const relative = decodeURIComponent((req.path || '').replace(/^\/+/, ''));
    if (relative && !relative.includes('..')) {
      const full = path.resolve(rootResolved, relative);
      if (full === rootResolved || full.startsWith(rootResolved + path.sep)) {
        if (isCompressSidecarName(path.basename(full)) || checkCompressLock(full)) {
          next();
          return;
        }
        healOrphanCompressBak(full);
      }
    }
    staticMw(req, res, next);
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
    app.use('/uploads', serveDiskUploads(diskRoot));
  } catch (err) {
    console.error('Failed to mount UPLOADS_DISK_PATH static:', err);
  }
}
