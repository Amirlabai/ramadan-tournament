import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  SHORT_EDGE_MAX,
  compressExistingUpload,
  compressImageToFile,
  verifyCompressedImage,
  writeCompressedUpload,
} from './imageCompress';

describe('imageCompress', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-img-compress-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function makeJpeg(name: string, width: number, height: number): Promise<string> {
    const p = path.join(tmpDir, name);
    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 40, g: 120, b: 60 },
      },
    })
      .jpeg({ quality: 95 })
      .toFile(p);
    return p;
  }

  it('resizes so short edge is at most 1080', async () => {
    const src = await makeJpeg('big.jpg', 3425, 3427);
    const dest = path.join(tmpDir, 'out.jpg');
    const result = await compressImageToFile(src, dest);
    expect(Math.min(result.width, result.height)).toBeLessThanOrEqual(SHORT_EDGE_MAX);
    expect(result.bytes).toBeGreaterThan(0);
    expect(result.bytes).toBeLessThanOrEqual(fs.statSync(src).size);
  });

  it('caps short edge on landscape 4000×2000 (long edge stays >1080)', async () => {
    const src = await makeJpeg('wide.jpg', 4000, 2000);
    const dest = path.join(tmpDir, 'wide-out.jpg');
    const result = await compressImageToFile(src, dest);
    expect(Math.min(result.width, result.height)).toBe(SHORT_EDGE_MAX);
    expect(Math.max(result.width, result.height)).toBeGreaterThan(SHORT_EDGE_MAX);
    expect(result.width).toBe(2160);
    expect(result.height).toBe(1080);
  });

  it('verify rejects when short edge still too large', async () => {
    const src = await makeJpeg('src.jpg', 2000, 2000);
    const fake = await makeJpeg('fake.jpg', 1500, 1500);
    const check = await verifyCompressedImage(src, fake);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toMatch(/short edge/);
  });

  it('writeCompressedUpload writes verified final and cleans tmp', async () => {
    const src = await makeJpeg('upload.jpg', 2400, 1800);
    const finalPath = path.join(tmpDir, 'final.jpg');
    await writeCompressedUpload(src, finalPath);
    expect(fs.existsSync(finalPath)).toBe(true);
    expect(fs.existsSync(`${finalPath}.rt-compress-tmp`)).toBe(false);
    const meta = await sharp(finalPath).metadata();
    expect(Math.min(meta.width!, meta.height!)).toBeLessThanOrEqual(SHORT_EDGE_MAX);
  });

  it('writeCompressedUpload copies already-small images as-is', async () => {
    const src = await makeJpeg('tiny.jpg', 100, 80);
    const finalPath = path.join(tmpDir, 'tiny-final.jpg');
    await writeCompressedUpload(src, finalPath);
    expect(fs.statSync(finalPath).size).toBe(fs.statSync(src).size);
  });

  it('writeCompressedUpload publishes original when verify fails', async () => {
    const src = await makeJpeg('orig.jpg', 400, 300);
    const finalPath = path.join(tmpDir, 'final-fallback.jpg');
    const srcBytes = fs.readFileSync(src);

    await writeCompressedUpload(src, finalPath, async (_source, dest) => {
      // Oversized bogus payload → verify fails → publish original.
      fs.writeFileSync(dest, Buffer.concat([srcBytes, Buffer.alloc(64 * 1024)]));
      return { width: 1080, height: 1080, bytes: fs.statSync(dest).size };
    });

    expect(fs.readFileSync(finalPath).equals(srcBytes)).toBe(true);
    expect(fs.existsSync(`${finalPath}.rt-compress-tmp`)).toBe(false);
  });

  it('compressExistingUpload restores orphan .rt-compress-bak on entry', async () => {
    const src = await makeJpeg('orphan.jpg', 2000, 2000);
    const bak = `${src}.rt-compress-bak`;
    fs.renameSync(src, bak);
    expect(fs.existsSync(src)).toBe(false);
    const result = await compressExistingUpload(src);
    expect(fs.existsSync(src)).toBe(true);
    expect(result.status === 'compressed' || result.status === 'kept_original').toBe(true);
  });

  it('compressExistingUpload skips already-small images', async () => {
    const src = await makeJpeg('small.jpg', 800, 600);
    const result = await compressExistingUpload(src);
    expect(result.status).toBe('skipped');
    if (result.status === 'skipped') expect(result.reason).toBe('already small');
  });

  it('compressExistingUpload replaces oversized file in place', async () => {
    const src = await makeJpeg('heavy.jpg', 3000, 2000);
    const before = fs.statSync(src).size;
    const result = await compressExistingUpload(src);
    expect(result.status).toBe('compressed');
    if (result.status === 'compressed') {
      expect(result.after).toBeLessThanOrEqual(before);
      expect(result.after).toBe(fs.statSync(src).size);
    }
    const meta = await sharp(src).metadata();
    expect(Math.min(meta.width!, meta.height!)).toBeLessThanOrEqual(SHORT_EDGE_MAX);
    expect(Math.max(meta.width!, meta.height!)).toBeGreaterThan(SHORT_EDGE_MAX);
    expect(fs.existsSync(`${src}.compressing`)).toBe(false);
  });
});
