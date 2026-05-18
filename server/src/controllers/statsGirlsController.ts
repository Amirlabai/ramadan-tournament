import { Request, Response } from 'express';
import { PointsStatsService } from '../services/PointsStatsService';
import { TeamDataService } from '../services/TeamDataService';
import { Division } from '@prisma/client';
import { NewsDataService } from '../services/NewsDataService';

export const getPointsStandings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const standings = await PointsStatsService.calculatePointsStandings();
    res.json(standings);
  } catch (error) {
    console.error('Get points standings error:', error);
    res.status(404).json({ error: 'no_active_girls_season', message: 'אין עונה פעילה לטורניר בנות' });
  }
};

export const getGirlsDashboard = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [standings, teams, news] = await Promise.all([
      PointsStatsService.calculatePointsStandings(),
      TeamDataService.getTeamsDocument(Division.girls),
      NewsDataService.getAllNews(Division.girls).catch(() => []),
    ]);

    res.json({
      standings,
      teams: teams.map((t: { id: number; name: string; logoUrl?: string }) => ({
        id: t.id,
        name: t.name,
        logoUrl: t.logoUrl,
      })),
      latestNews: news.length > 0 ? news[0] : null,
    });
  } catch (error) {
    console.error('Get girls dashboard error:', error);
    res.status(404).json({ error: 'no_active_girls_season', message: 'אין עונה פעילה לטורניר בנות' });
  }
};
