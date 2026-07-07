import { describe, expect, it } from 'vitest';
import {
  BOYS_DEFAULT_LOGO_SEASON_ID,
  MOCK_DEV_SEASON_ID,
  buildLogosBySeasonId,
  effectiveTeamLogoUrl,
  teamCustomLogoUrl,
  type CrestMapFile,
} from './teamDefaultLogos';

const baseMap = (): CrestMapFile => ({
  primaryBoysSeasonId: 'prod-season',
  mockDevSeasonId: 'mock-season',
  bySeasonId: {
    'prod-season': {
      mappings: [
        { localTeamId: 1, localAssetPath: 'assets/images/teams/wc-mexico.svg' },
        { localTeamId: 3, localAssetPath: 'assets/images/teams/wc-germany.svg' },
      ],
    },
    'mock-season': { inheritSeasonId: 'prod-season' },
  },
});

describe('teamDefaultLogos', () => {
  it('returns custom logo when set', () => {
    expect(
      effectiveTeamLogoUrl(1, '/uploads/logos/team_1.png', BOYS_DEFAULT_LOGO_SEASON_ID)
    ).toBe('/uploads/logos/team_1.png');
  });

  it('custom upload beats default for mapped team id', () => {
    expect(
      effectiveTeamLogoUrl(3, '/uploads/logos/team_3.png', BOYS_DEFAULT_LOGO_SEASON_ID)
    ).toBe('/uploads/logos/team_3.png');
  });

  it('falls back to static crest for mapped team ids in boys season', () => {
    expect(effectiveTeamLogoUrl(3, '', BOYS_DEFAULT_LOGO_SEASON_ID)).toBe(
      'assets/images/teams/wc-germany.svg'
    );
    expect(effectiveTeamLogoUrl(6, null, BOYS_DEFAULT_LOGO_SEASON_ID)).toBe(
      'assets/images/teams/wc-morocco.svg'
    );
  });

  it('falls back via inheritSeasonId for mock dev season', () => {
    expect(effectiveTeamLogoUrl(3, '', MOCK_DEV_SEASON_ID)).toBe(
      'assets/images/teams/wc-germany.svg'
    );
  });

  it('returns empty for unmapped teams without custom logo', () => {
    expect(effectiveTeamLogoUrl(99, '', BOYS_DEFAULT_LOGO_SEASON_ID)).toBe('');
  });

  it('skips defaults for unknown season', () => {
    expect(effectiveTeamLogoUrl(3, '', 'girls-season-id')).toBe('');
    expect(effectiveTeamLogoUrl(3, '')).toBe('');
  });

  it('falls back to hammers logo for team id 5', () => {
    expect(effectiveTeamLogoUrl(5, '', BOYS_DEFAULT_LOGO_SEASON_ID)).toBe(
      'assets/images/teams/hammers.svg'
    );
  });

  it('falls back to fc-rihaniya logo for team id 7', () => {
    expect(effectiveTeamLogoUrl(7, '', BOYS_DEFAULT_LOGO_SEASON_ID)).toBe(
      'assets/images/teams/fc-rihaniya.svg'
    );
  });

  it('trims custom logo', () => {
    expect(teamCustomLogoUrl('  /x.png  ')).toBe('/x.png');
  });

  describe('buildLogosBySeasonId validation', () => {
    it('throws when primaryBoysSeasonId is missing from bySeasonId', () => {
      const map = baseMap();
      map.primaryBoysSeasonId = 'missing-season';
      expect(() => buildLogosBySeasonId(map)).toThrow(/primaryBoysSeasonId/);
    });

    it('throws when inheritSeasonId target is missing', () => {
      const map = baseMap();
      map.bySeasonId['mock-season'] = { inheritSeasonId: 'ghost-season' };
      expect(() => buildLogosBySeasonId(map)).toThrow(/inheritSeasonId/);
    });

    it('throws on duplicate localTeamId', () => {
      const map = baseMap();
      map.bySeasonId['prod-season'] = {
        mappings: [
          { localTeamId: 1, localAssetPath: 'a.svg' },
          { localTeamId: 1, localAssetPath: 'b.svg' },
        ],
      };
      expect(() => buildLogosBySeasonId(map)).toThrow(/Duplicate localTeamId 1/);
    });

    it('throws on circular inheritSeasonId', () => {
      const map: CrestMapFile = {
        primaryBoysSeasonId: 'a',
        mockDevSeasonId: 'b',
        bySeasonId: {
          a: { inheritSeasonId: 'b' },
          b: { inheritSeasonId: 'a' },
        },
      };
      expect(() => buildLogosBySeasonId(map)).toThrow(/Circular inheritSeasonId/);
    });
  });
});
