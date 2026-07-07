import { describe, expect, it } from 'vitest';
import type { Player } from '../types';
import { sortRosterPlayers } from './rosterSort';

function makePlayer(overrides: Partial<Player> & Pick<Player, 'memberId'>): Player {
  return {
    firstName: 'Test',
    lastName: 'Player',
    nickname: 'Tester',
    number: 10,
    position: 'קשר',
    isCaptain: false,
    ...overrides,
  };
}

describe('sortRosterPlayers', () => {
  it('orders owner, captain, goalkeeper, defense, attack, then unassigned', () => {
    const owner = makePlayer({ memberId: 1, isTeamOwner: true, number: 99 });
    const captain = makePlayer({ memberId: 2, isCaptain: true, number: 9 });
    const gk = makePlayer({ memberId: 3, squadRole: 'goalkeeper', position: 'שוער', number: 1 });
    const defense = makePlayer({ memberId: 4, squadRole: 'defense', number: 4 });
    const attack = makePlayer({ memberId: 5, squadRole: 'attack', number: 11 });
    const unassigned = makePlayer({ memberId: 6, number: 7 });

    const sorted = sortRosterPlayers([unassigned, attack, defense, gk, captain, owner]);

    expect(sorted.map((p) => p.memberId)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('puts bench warmers after other unassigned players in tier 6', () => {
    const regular = makePlayer({ memberId: 1, position: 'קשר', number: 8 });
    const bench = makePlayer({ memberId: 2, position: 'מחמם ספסל', number: 3 });

    const sorted = sortRosterPlayers([bench, regular]);

    expect(sorted.map((p) => p.memberId)).toEqual([1, 2]);
  });

  it('orders other squadRole players before unassigned tier', () => {
    const squadCaptain = makePlayer({
      memberId: 1,
      squadRole: 'captain',
      isCaptain: false,
      number: 10,
    });
    const unassigned = makePlayer({ memberId: 2, number: 5 });

    const sorted = sortRosterPlayers([unassigned, squadCaptain]);

    expect(sorted.map((p) => p.memberId)).toEqual([1, 2]);
  });

  it('breaks ties within the same tier by jersey number', () => {
    const low = makePlayer({ memberId: 1, squadRole: 'defense', number: 2 });
    const high = makePlayer({ memberId: 2, squadRole: 'defense', number: 5 });

    const sorted = sortRosterPlayers([high, low]);

    expect(sorted.map((p) => p.memberId)).toEqual([1, 2]);
  });
});
