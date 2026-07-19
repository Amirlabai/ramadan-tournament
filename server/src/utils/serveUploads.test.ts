import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { serveNonEmptyUploads } from './serveUploads';

describe('serveNonEmptyUploads', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-serve-uploads-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  function mockRes() {
    return {
      sendFile: vi.fn(),
    } as unknown as Response & { sendFile: ReturnType<typeof vi.fn> };
  }

  it('falls through on path traversal attempts', () => {
    const next = vi.fn();
    const res = mockRes();
    const mw = serveNonEmptyUploads(tmpRoot);
    mw({ path: '../secret.txt' } as Request, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it('falls through for zero-byte files so a later mount can serve', () => {
    const empty = path.join(tmpRoot, 'logos', 'empty.jpg');
    fs.mkdirSync(path.dirname(empty), { recursive: true });
    fs.writeFileSync(empty, '');
    const next = vi.fn();
    const res = mockRes();
    const mw = serveNonEmptyUploads(tmpRoot);
    mw({ path: '/logos/empty.jpg' } as Request, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it('serves non-empty files', () => {
    const file = path.join(tmpRoot, 'logos', 'ok.jpg');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'jpeg-bytes');
    const next = vi.fn();
    const res = mockRes();
    const mw = serveNonEmptyUploads(tmpRoot);
    mw({ path: '/logos/ok.jpg' } as Request, res, next);
    expect(res.sendFile).toHaveBeenCalledWith(file);
    expect(next).not.toHaveBeenCalled();
  });

  it('falls through while a .compressing lock exists so disk can serve', () => {
    const file = path.join(tmpRoot, 'logos', 'busy.jpg');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'jpeg-bytes');
    fs.writeFileSync(`${file}.compressing`, '1');
    const next = vi.fn();
    const res = mockRes();
    const mw = serveNonEmptyUploads(tmpRoot);
    mw({ path: '/logos/busy.jpg' } as Request, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it('falls through for compress sidecar paths', () => {
    const file = path.join(tmpRoot, 'logos', 'ok.jpg.rt-compress-tmp');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'tmp-bytes');
    const next = vi.fn();
    const res = mockRes();
    const mw = serveNonEmptyUploads(tmpRoot);
    mw({ path: '/logos/ok.jpg.rt-compress-tmp' } as Request, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it('heals orphan .rt-compress-bak then serves', () => {
    const file = path.join(tmpRoot, 'logos', 'healed.jpg');
    const bak = `${file}.rt-compress-bak`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(bak, 'jpeg-from-bak');
    const next = vi.fn();
    const res = mockRes();
    const mw = serveNonEmptyUploads(tmpRoot);
    mw({ path: '/logos/healed.jpg' } as Request, res, next);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.existsSync(bak)).toBe(false);
    expect(res.sendFile).toHaveBeenCalledWith(file);
    expect(next).not.toHaveBeenCalled();
  });
});
