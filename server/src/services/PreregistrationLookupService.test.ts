import { describe, expect, it, beforeEach } from 'vitest';
import { PreregistrationLookupService } from './PreregistrationLookupService';

const TEST_SEASON = 'test-season';

describe('PreregistrationLookupService', () => {
  beforeEach(() => {
    PreregistrationLookupService._resetForTests();
  });

  it('evaluate returns full_match only when both id and birth year match', async () => {
    PreregistrationLookupService._loadForTests(
      TEST_SEASON,
      [
        {
          name: 'אסעד',
          email: 'captain@example.com',
          personalId: '043382753',
          birthYear: 1981,
          teamName: 'מקסיקו',
          role: 'captain',
        },
      ],
      []
    );
    expect((await PreregistrationLookupService.evaluate(TEST_SEASON, '043382753', 1981)).kind).toBe(
      'full_match'
    );
    expect((await PreregistrationLookupService.evaluate(TEST_SEASON, '043382753', 1982)).kind).toBe(
      'field_mismatch'
    );
  });

  it('evaluate detects admin_missing birth_year from ID-only partial', async () => {
    PreregistrationLookupService._loadForTests(TEST_SEASON, [], [
      {
        name: 'סאו בושנק',
        personalId: '305088411',
        adminMissing: 'birth_year',
        teamName: 'big boss',
        role: 'player',
      },
    ]);
    expect(
      (await PreregistrationLookupService.evaluate(TEST_SEASON, '305088411', 1990)).kind
    ).toBe('admin_missing');
  });

  it('evaluate detects admin_missing personal_id from year-only partial', async () => {
    PreregistrationLookupService._loadForTests(TEST_SEASON, [], [
      {
        name: 'נארת',
        birthYear: 1986,
        adminMissing: 'personal_id',
        teamName: 'מקסיקו',
        role: 'player',
      },
    ]);
    expect(
      (await PreregistrationLookupService.evaluate(TEST_SEASON, '043382753', 1986)).kind
    ).toBe('admin_missing');
  });

  it('evaluate returns field_mismatch when year matches different person', async () => {
    PreregistrationLookupService._loadForTests(
      TEST_SEASON,
      [
        {
          name: 'אסעד',
          personalId: '043382753',
          birthYear: 1981,
          teamName: 'מקסיקו',
          role: 'captain',
        },
      ],
      []
    );
    expect(
      (await PreregistrationLookupService.evaluate(TEST_SEASON, '205744428', 1981)).kind
    ).toBe('field_mismatch');
  });

  it('never throws on invalid input', async () => {
    PreregistrationLookupService._loadForTests(TEST_SEASON, [], []);
    await expect(
      PreregistrationLookupService.evaluate(TEST_SEASON, 'bad', 1990)
    ).resolves.toEqual({ kind: 'no_match' });
  });
});
