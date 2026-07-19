import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/** Max length of the shorter image edge after resize (no upscale). */
export const SHORT_EDGE_MAX = 1080;

export const COMPRESS_LOCK_SUFFIX = '.compressing';
export const COMPRESS_TMP_SUFFIX = '.rt-compress-tmp';
export const COMPRESS_BAK_SUFFIX = '.rt-compress-bak';
/** Sync script stage file; keep in sidecar list so it is never served. */
export const SYNC_TMP_SUFFIX = '.rt-sync-tmp';

/** Ignore / clear compress locks older than this (crash recovery). */
export const COMPRESS_LOCK_MAX_AGE_MS = 10 * 60 * 1000;

const JPEG_QUALITY = 82;

export function compressLockPath(filePath: string): string {
  return `${filePath}${COMPRESS_LOCK_SUFFIX}`;
}

export function isCompressSidecarName(fileName: string): boolean {
  return (
    fileName.endsWith(COMPRESS_LOCK_SUFFIX) ||
    fileName.endsWith(COMPRESS_TMP_SUFFIX) ||
    fileName.endsWith(COMPRESS_BAK_SUFFIX) ||
    fileName.endsWith(SYNC_TMP_SUFFIX)
  );
}

/** If `full` is missing but `{full}.rt-compress-bak` exists, rename bak → full. */
export function healOrphanCompressBak(fullPath: string): boolean {
  if (fs.existsSync(fullPath)) return false;
  const bakPath = `${fullPath}${COMPRESS_BAK_SUFFIX}`;
  if (!fs.existsSync(bakPath)) return false;
  try {
    fs.renameSync(bakPath, fullPath);
    return true;
  } catch {
    return false;
  }
}

function shortEdge(width: number, height: number): number {
  return Math.min(width, height);
}

function unlinkQuiet(p: string): void {
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    /* ignore */
  }
}

/** True when a fresh `.compressing` lock exists; clears stale locks (GET side effect). */
export function checkCompressLock(fullPath: string): boolean {
  const lockPath = compressLockPath(fullPath);
  try {
    if (!fs.existsSync(lockPath)) return false;
    const age = Date.now() - fs.statSync(lockPath).mtimeMs;
    if (age > COMPRESS_LOCK_MAX_AGE_MS) {
      unlinkQuiet(lockPath);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Exclusive create; clears stale lock first. Returns false if held. */
function tryAcquireLock(lockPath: string): boolean {
  try {
    if (fs.existsSync(lockPath)) {
      const age = Date.now() - fs.statSync(lockPath).mtimeMs;
      if (age > COMPRESS_LOCK_MAX_AGE_MS) unlinkQuiet(lockPath);
      else return false;
    }
  } catch {
    return false;
  }
  try {
    fs.writeFileSync(lockPath, String(Date.now()), { flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}

async function isAnimatedGif(inputPath: string): Promise<boolean> {
  const meta = await sharp(inputPath, { animated: true }).metadata();
  return (meta.pages ?? 1) > 1;
}

async function copyWithMeta(
  sourcePath: string,
  destPath: string
): Promise<{ width: number; height: number; bytes: number }> {
  fs.copyFileSync(sourcePath, destPath);
  const st = fs.statSync(destPath);
  const meta = await sharp(destPath).metadata();
  return {
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    bytes: st.size,
  };
}

/**
 * Resize so min(w,h) <= SHORT_EDGE_MAX. Writes to `destPath` (must not be the
 * source). Caller verifies before replacing any original.
 * Already-small / animated GIF: plain copy (no re-encode).
 */
export async function compressImageToFile(
  sourcePath: string,
  destPath: string
): Promise<{ width: number; height: number; bytes: number }> {
  if (await isAnimatedGif(sourcePath)) {
    return copyWithMeta(sourcePath, destPath);
  }

  const meta = await sharp(sourcePath).rotate().metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new Error('Could not read image dimensions');
  }

  // ponytail: skip re-encode when already within budget
  if (shortEdge(width, height) <= SHORT_EDGE_MAX) {
    return copyWithMeta(sourcePath, destPath);
  }

  // Cap the short edge only (e.g. 4000×2000 → 2160×1080, not 1080×720).
  const resizeOpts =
    width <= height
      ? { width: SHORT_EDGE_MAX, withoutEnlargement: true as const }
      : { height: SHORT_EDGE_MAX, withoutEnlargement: true as const };

  let pipeline = sharp(sourcePath).rotate().resize(resizeOpts);

  const format = (meta.format || path.extname(sourcePath).slice(1).toLowerCase()) as string;
  if (format === 'jpeg' || format === 'jpg') {
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
  } else if (format === 'png') {
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else if (format === 'webp') {
    pipeline = pipeline.webp({ quality: JPEG_QUALITY });
  } else if (format === 'gif') {
    pipeline = pipeline.gif();
  }

  await pipeline.toFile(destPath);
  const outMeta = await sharp(destPath).metadata();
  const st = fs.statSync(destPath);
  return {
    width: outMeta.width ?? 0,
    height: outMeta.height ?? 0,
    bytes: st.size,
  };
}

export type VerifyCompressResult =
  | { ok: true }
  | { ok: false; reason: string };

/** Checks compressed output before the original may be discarded. */
export async function verifyCompressedImage(
  sourcePath: string,
  compressedPath: string
): Promise<VerifyCompressResult> {
  if (!fs.existsSync(compressedPath)) {
    return { ok: false, reason: 'compressed file missing' };
  }
  const outStat = fs.statSync(compressedPath);
  if (!outStat.isFile() || outStat.size <= 0) {
    return { ok: false, reason: 'compressed file empty' };
  }

  const srcStat = fs.statSync(sourcePath);
  if (outStat.size > srcStat.size) {
    return { ok: false, reason: 'compressed larger than original' };
  }

  let outMeta: sharp.Metadata;
  try {
    outMeta = await sharp(compressedPath).metadata();
  } catch (err) {
    return {
      ok: false,
      reason: `compressed not decodable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const w = outMeta.width ?? 0;
  const h = outMeta.height ?? 0;
  if (!w || !h) {
    return { ok: false, reason: 'compressed missing dimensions' };
  }

  let srcMeta: sharp.Metadata;
  try {
    srcMeta = await sharp(sourcePath).rotate().metadata();
  } catch {
    srcMeta = {};
  }
  const srcW = srcMeta.width ?? 0;
  const srcH = srcMeta.height ?? 0;
  if (srcW && srcH && shortEdge(srcW, srcH) > SHORT_EDGE_MAX) {
    if (shortEdge(w, h) > SHORT_EDGE_MAX) {
      return { ok: false, reason: `short edge still ${shortEdge(w, h)}` };
    }
  }

  return { ok: true };
}

/**
 * Compress `sourcePath` into `finalPath`. On verify failure, publishes the
 * original bytes so the upload still succeeds. Multer temp is left for caller.
 * `compress` is injectable for tests (same-module stub).
 */
export async function writeCompressedUpload(
  sourcePath: string,
  finalPath: string,
  compress: typeof compressImageToFile = compressImageToFile
): Promise<void> {
  const tmpPath = `${finalPath}${COMPRESS_TMP_SUFFIX}`;
  unlinkQuiet(tmpPath);
  try {
    await compress(sourcePath, tmpPath);
    const check = await verifyCompressedImage(sourcePath, tmpPath);
    if (!check.ok) {
      fs.copyFileSync(sourcePath, finalPath);
      return;
    }
    fs.copyFileSync(tmpPath, finalPath);
  } finally {
    unlinkQuiet(tmpPath);
  }
}

/**
 * In-place compress for backfill. Encodes without locking; exclusive lock only
 * around the bak/tmp rename window. Keeps original if verify fails.
 */
export async function compressExistingUpload(filePath: string): Promise<
  | { status: 'skipped'; reason: string }
  | { status: 'compressed'; before: number; after: number }
  | { status: 'kept_original'; reason: string }
> {
  if (isCompressSidecarName(path.basename(filePath))) {
    return { status: 'skipped', reason: 'sidecar' };
  }

  const bakPath = `${filePath}${COMPRESS_BAK_SUFFIX}`;
  // Heal hard-kill after rename(file→bak): orphan bak, missing original.
  healOrphanCompressBak(filePath);

  if (!fs.existsSync(filePath)) {
    return { status: 'skipped', reason: 'missing' };
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!/^\.(jpe?g|png|webp|gif)$/i.test(ext)) {
    return { status: 'skipped', reason: 'not image' };
  }

  let meta: sharp.Metadata;
  try {
    meta = await sharp(filePath).rotate().metadata();
  } catch {
    return { status: 'skipped', reason: 'unreadable' };
  }
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) {
    return { status: 'skipped', reason: 'no dimensions' };
  }
  if (shortEdge(w, h) <= SHORT_EDGE_MAX) {
    return { status: 'skipped', reason: 'already small' };
  }
  if ((meta.pages ?? 1) > 1) {
    return { status: 'skipped', reason: 'animated gif' };
  }

  const lockPath = compressLockPath(filePath);
  const tmpPath = `${filePath}${COMPRESS_TMP_SUFFIX}`;
  const before = fs.statSync(filePath).size;

  unlinkQuiet(tmpPath);
  await compressImageToFile(filePath, tmpPath);
  const check = await verifyCompressedImage(filePath, tmpPath);
  if (!check.ok) {
    unlinkQuiet(tmpPath);
    return { status: 'kept_original', reason: check.reason };
  }

  if (!tryAcquireLock(lockPath)) {
    unlinkQuiet(tmpPath);
    return { status: 'skipped', reason: 'locked' };
  }

  try {
    unlinkQuiet(bakPath);
    fs.renameSync(filePath, bakPath);
    try {
      fs.renameSync(tmpPath, filePath);
      unlinkQuiet(bakPath);
    } catch (err) {
      if (!fs.existsSync(filePath) && fs.existsSync(bakPath)) {
        fs.renameSync(bakPath, filePath);
      }
      throw err;
    }
    const after = fs.statSync(filePath).size;
    return { status: 'compressed', before, after };
  } finally {
    unlinkQuiet(lockPath);
    unlinkQuiet(tmpPath);
    // Crash after rename(file→bak): restore original if final is missing.
    if (!fs.existsSync(filePath) && fs.existsSync(bakPath)) {
      try {
        fs.renameSync(bakPath, filePath);
      } catch {
        /* leave bak for manual recovery */
      }
    } else {
      unlinkQuiet(bakPath);
    }
  }
}
