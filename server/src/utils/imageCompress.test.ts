import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  SHORT_EDGE_MAX,
  BANNER_ASPECT,
  BANNER_MAX_WIDTH,
  BANNER_MAX_HEIGHT,
  compressExistingUpload,
  compressImageToFile,
  compressBannerImageToFile,
  verifyCompressedImage,
  writeCompressedUpload,
  writeCompressedBannerUpload,
} from './imageCompress';

describe('imageCompress', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-img-compress-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* Windows may still hold a sharp handle briefly */
    }
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

  it('compressBannerImageToFile cover-crops to 4:1 within 1080×270', async () => {
    const src = await makeJpeg('portrait-banner.jpg', 2000, 3000);
    const dest = path.join(tmpDir, 'banner-out.png');
    const result = await compressBannerImageToFile(src, dest);
    expect(result.width).toBeLessThanOrEqual(BANNER_MAX_WIDTH);
    expect(result.height).toBeLessThanOrEqual(BANNER_MAX_HEIGHT);
    expect(result.width / result.height).toBeCloseTo(BANNER_ASPECT, 1);
    expect((await sharp(dest).metadata()).format).toBe('png');
  });

  it('writeCompressedBannerUpload writes 4:1 banner', async () => {
    const src = await makeJpeg('wide-banner.jpg', 4000, 1000);
    const finalPath = path.join(tmpDir, 'banner-final.png');
    await writeCompressedBannerUpload(src, finalPath);
    const meta = await sharp(finalPath).metadata();
    expect(meta.width!).toBeLessThanOrEqual(BANNER_MAX_WIDTH);
    expect(meta.height!).toBeLessThanOrEqual(BANNER_MAX_HEIGHT);
    expect(meta.width! / meta.height!).toBeCloseTo(BANNER_ASPECT, 1);
    expect(meta.format).toBe('png');
  });

  it('writeCompressedBannerUpload rejects when verify fails (no raw publish)', async () => {
    const src = await makeJpeg('reject-src.jpg', 400, 300);
    const finalPath = path.join(tmpDir, 'reject-final.png');
    const { BannerCompressError } = await import('./imageCompress');
    await expect(
      writeCompressedBannerUpload(src, finalPath, async (_source, dest) => {
        await sharp({
          create: { width: 2000, height: 2000, channels: 3, background: { r: 1, g: 2, b: 3 } },
        })
          .jpeg()
          .toFile(dest);
        return { width: 2000, height: 2000, bytes: fs.statSync(dest).size };
      })
    ).rejects.toBeInstanceOf(BannerCompressError);
    expect(fs.existsSync(finalPath)).toBe(false);
  });

  it('compressBannerImageToFile re-encodes GIF to PNG within banner bounds', async () => {
    const src = path.join(tmpDir, 'banner.gif');
    await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .gif()
      .toFile(src);
    const dest = path.join(tmpDir, 'banner-from-gif.png');
    const result = await compressBannerImageToFile(src, dest);
    expect(result.width).toBeLessThanOrEqual(BANNER_MAX_WIDTH);
    expect(result.height).toBeLessThanOrEqual(BANNER_MAX_HEIGHT);
    expect(result.width / result.height).toBeCloseTo(BANNER_ASPECT, 1);
    const meta = await sharp(dest).metadata();
    expect(meta.format).toBe('png');
  });

  it('compressBannerImageToFile keeps PNG alpha on in-bounds copy', async () => {
    const src = path.join(tmpDir, 'inset-banner.png');
    await sharp({
      create: {
        width: 800,
        height: 200,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 200,
              height: 100,
              channels: 3,
              background: { r: 40, g: 120, b: 80 },
            },
          })
            .png()
            .toBuffer(),
          left: 300,
          top: 50,
        },
      ])
      .png()
      .toFile(src);
    const dest = path.join(tmpDir, 'inset-out.png');
    await compressBannerImageToFile(src, dest);
    expect((await sharp(dest).metadata()).format).toBe('png');
    const { data } = await sharp(dest).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    // Corner pixel should stay fully transparent.
    expect(data[3]).toBe(0);
  });
});
