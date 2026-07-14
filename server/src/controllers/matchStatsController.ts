import { Request, Response } from 'express';
import { MatchStatsService } from '../services/MatchStatsService';
import { MATCH_STATS_SALT_PERSIST_FAILED } from '../services/matchStatsSalt';

function parseMatchId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export const getMatchStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const matchId = parseMatchId(req.params.id);
    if (matchId == null) {
      res.status(400).json({ error: 'מזהה משחק לא תקין' });
      return;
    }

    const payload = await MatchStatsService.getPayload(matchId);
    if (!payload) {
      res.status(404).json({ error: 'סטטיסטיקה לא זמינה למשחק זה (או ניצחון טכני)' });
      return;
    }

    res.json(payload);
  } catch (error) {
    console.error('Get match stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const regenerateMatchStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const matchId = parseMatchId(req.params.id);
    if (matchId == null) {
      res.status(400).json({ error: 'מזהה משחק לא תקין' });
      return;
    }

    const payload = await MatchStatsService.regenerate(matchId);
    if (!payload) {
      res.status(404).json({ error: 'משחק לא נמצא, ניצחון טכני, או שסטטיסטיקה לא זמינה עדיין' });
      return;
    }

    res.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === MATCH_STATS_SALT_PERSIST_FAILED) {
      res.status(503).json({ error: 'לא ניתן לשמור את חידוש הסטטיסטיקה כרגע' });
      return;
    }
    console.error('Regenerate match stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
