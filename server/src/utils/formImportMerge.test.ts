import { describe, expect, it } from 'vitest';
import {
  nextJerseyNumber,
  personTeamRoleKey,
  shouldSkipPreregInsertWithKeys,
  shouldSkipRosterInsert,
  splitFormPersonName,
} from './formImportMerge';

describe('formImportMerge', () => {
  it('skips prereg insert when same team/name/role already in Postgres', () => {
    const roleKey = personTeamRoleKey('מקסיקו', 'אסעד', 'captain');
    const reason = shouldSkipPreregInsertWithKeys(
      {
        kind: 'full',
        name: 'אסעד',
        personalId: '043382753',
        birthYear: 1981,
        teamName: 'מקסיקו',
        role: 'captain',
        email: 'a@example.com',
      },
      new Set([roleKey]),
      new Set(),
      new Set(),
      new Set(),
      new Set(),
      (id) => `enc:${id}`
    );
    expect(reason).toBe('already_in_database');
  });

  it('skips prereg insert when identity matches linked roster player', () => {
    const idEnc = 'enc:043382753';
    const reason = shouldSkipPreregInsertWithKeys(
      {
        kind: 'full',
        name: 'אסעד',
        personalId: '043382753',
        birthYear: 1981,
        teamName: 'גרמניה',
        role: 'player',
      },
      new Set(),
      new Set(),
      new Set(),
      new Set(),
      new Set([`${idEnc}:1981`, idEnc]),
      (id) => `enc:${id}`
    );
    expect(reason).toBe('linked_roster_player');
  });

  it('skips roster insert for any existing player on the team', () => {
    const reason = shouldSkipRosterInsert(
      {
        kind: 'full',
        name: 'אדם בזדוג',
        personalId: '302841119',
        birthYear: 1990,
        teamName: 'איטליה',
        role: 'captain',
      },
      'איטליה',
      2,
      [
        {
          memberId: 2,
          teamId: 2,
          teamName: 'איטליה',
          userId: 'user-1',
          firstName: 'אדם',
          lastName: 'בזדוג',
          nickname: 'אדם בזדוג',
          personalIdEnc: 'enc:302841119',
          birthYear: 1990,
        },
      ],
      new Set(['enc:302841119:1990', 'enc:302841119']),
      (id) => `enc:${id}`
    );
    expect(reason).toBe('linked_user');
  });

  it('skips roster insert for unlinked placeholder already on team', () => {
    const reason = shouldSkipRosterInsert(
      {
        kind: 'partial',
        name: 'נאלבי נאפסו',
        adminMissing: 'birth_year',
        personalId: '203358643',
        teamName: 'איטליה',
        role: 'goalkeeper',
      },
      'איטליה',
      2,
      [
        {
          memberId: 5,
          teamId: 2,
          teamName: 'איטליה',
          userId: null,
          firstName: 'נאלבי',
          lastName: 'נאפסו',
          nickname: 'נאלבי נאפסו',
          personalIdEnc: 'enc:203358643',
          birthYear: null,
        },
      ],
      new Set(),
      (id) => `enc:${id}`
    );
    expect(reason).toBe('already_in_database');
  });

  it('picks next free jersey number', () => {
    expect(nextJerseyNumber([1, 3, 10])).toBe(2);
    expect(nextJerseyNumber([1, 2, 3])).toBe(4);
  });

  it('does not match roster player by first name alone when last name is set', () => {
    const reason = shouldSkipRosterInsert(
      {
        kind: 'partial',
        name: 'נאלבי',
        adminMissing: 'birth_year',
        teamName: 'איטליה',
        role: 'player',
      },
      'איטליה',
      2,
      [
        {
          memberId: 5,
          teamId: 2,
          teamName: 'איטליה',
          userId: null,
          firstName: 'נאלבי',
          lastName: 'נאפסו',
          nickname: 'נאלבי נאפסו',
          personalIdEnc: 'enc:203358643',
          birthYear: null,
        },
      ],
      new Set(),
      (id) => `enc:${id}`
    );
    expect(reason).toBeNull();
  });

  it('splits Hebrew display names', () => {
    expect(splitFormPersonName('אדם בזדוג')).toEqual({
      firstName: 'אדם',
      lastName: 'בזדוג',
      nickname: 'אדם בזדוג',
    });
  });
});
