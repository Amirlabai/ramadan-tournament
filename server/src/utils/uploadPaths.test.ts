import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('uploadPaths', () => {
  const prevCwd = process.cwd();
  const prevEnv = { ...process.env };
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-uploads-'));
    process.chdir(tmpRoot);
    process.env = { ...prevEnv };
    delete process.env.UPLOADS_DISK_PATH;
    process.env.NODE_ENV = 'test';
    vi.resetModules();
  });

  afterEach(() => {
    process.chdir(prevCwd);
    process.env = { ...prevEnv };
    vi.resetModules();
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('uses cwd/uploads as disk root when UPLOADS_DISK_PATH unset in non-production', async () => {
    const { diskUploadsRoot, repoUploadsRoot, uploadWriteDir, publicUploadUrl } = await import(
      './uploadPaths'
    );
    expect(diskUploadsRoot()).toBe(repoUploadsRoot());
    const dir = uploadWriteDir('logos');
    expect(dir).toBe(path.join(repoUploadsRoot(), 'logos'));
    expect(fs.existsSync(dir)).toBe(true);
    expect(publicUploadUrl('logos', 'a.jpg')).toBe('/uploads/logos/a.jpg');
  });

  it('writes under UPLOADS_DISK_PATH when set', async () => {
    const disk = path.join(tmpRoot, 'persistent');
    process.env.UPLOADS_DISK_PATH = disk;
    vi.resetModules();
    const { uploadWriteDir, hasSeparateDiskUploads } = await import('./uploadPaths');
    expect(hasSeparateDiskUploads()).toBe(true);
    const dir = uploadWriteDir('players');
    expect(dir).toBe(path.join(disk, 'players'));
  });

  it('unlinkUpload removes from both repo and disk roots', async () => {
    const disk = path.join(tmpRoot, 'persistent');
    process.env.UPLOADS_DISK_PATH = disk;
    vi.resetModules();
    const { repoUploadsRoot, unlinkUpload } = await import('./uploadPaths');

    const repoFile = path.join(repoUploadsRoot(), 'logos', 'team_1.jpg');
    const diskFile = path.join(disk, 'logos', 'team_1.jpg');
    fs.mkdirSync(path.dirname(repoFile), { recursive: true });
    fs.mkdirSync(path.dirname(diskFile), { recursive: true });
    fs.writeFileSync(repoFile, 'repo');
    fs.writeFileSync(diskFile, 'disk');

    unlinkUpload('/uploads/logos/team_1.jpg');
    expect(fs.existsSync(repoFile)).toBe(false);
    expect(fs.existsSync(diskFile)).toBe(false);
  });

  it('isUploadsDiskMisconfigured is true in production without env', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.UPLOADS_DISK_PATH;
    vi.resetModules();
    const { isUploadsDiskMisconfigured, assertUploadsWritable } = await import('./uploadPaths');
    expect(isUploadsDiskMisconfigured()).toBe(true);
    expect(() => assertUploadsWritable()).toThrow(/UPLOADS_DISK_PATH/);
  });
});
