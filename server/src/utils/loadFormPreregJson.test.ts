import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadFormPreregFromJson } from './loadFormPreregJson';

describe('loadFormPreregJson', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prereg-json-'));

  afterEach(() => {
    for (const file of fs.readdirSync(tmpDir)) {
      fs.unlinkSync(path.join(tmpDir, file));
    }
  });

  it('loads full and partial entry arrays from parse dumps', () => {
    const fullPath = path.join(tmpDir, 'full.json');
    const partialPath = path.join(tmpDir, 'partial.json');
    fs.writeFileSync(
      fullPath,
      JSON.stringify({
        entries: [{ name: 'A', personalId: '123456789', birthYear: 1990, teamName: 'T', role: 'player' }],
      })
    );
    fs.writeFileSync(
      partialPath,
      JSON.stringify({
        entries: [
          {
            name: 'B',
            adminMissing: 'birth_year',
            personalId: '987654321',
            teamName: 'T',
            role: 'player',
          },
        ],
      })
    );

    const result = loadFormPreregFromJson(fullPath, partialPath);
    expect(result.full).toHaveLength(1);
    expect(result.partial).toHaveLength(1);
    expect(result.report).toEqual([]);
  });

  it('skips invalid JSON rows instead of loading corrupt entries', () => {
    const fullPath = path.join(tmpDir, 'bad-full.json');
    fs.writeFileSync(
      fullPath,
      JSON.stringify({
        entries: [
          { name: 'A', personalId: '123456789', birthYear: 1990, teamName: 'T', role: 'player' },
          { name: 'bad', teamName: 'T' },
        ],
      })
    );

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = loadFormPreregFromJson(fullPath);
    expect(result.full).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
