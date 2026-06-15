import { Request, Response } from 'express';
import { FootballDataService } from '../services/FootballDataService';
import { config } from '../config/env';

export async function getMeta(req: Request, res: Response): Promise<void> {
  try {
    const meta = await FootballDataService.getMeta();
    res.json({
      seasonId: 'worldcup-external',
      yearMonth: config.footballDataSeason,
      division: 'worldcup',
      scoringMode: 'football',
      displayName: `מונדיאל ${config.footballDataSeason}`,
      isActive: true,
      competition: meta,
    });
  } catch (error) {
    console.error('World Cup meta error:', error);
    res.status(503).json({ error: 'שגיאה בטעינת נתוני מונדיאל' });
  }
}

export async function getMatches(req: Request, res: Response): Promise<void> {
  try {
    const matches = await FootballDataService.getMatches();
    res.json(matches);
  } catch (error) {
    console.error('World Cup matches error:', error);
    res.status(503).json({ error: 'שגיאה בטעינת משחקי מונדיאל' });
  }
}

export async function getTeams(req: Request, res: Response): Promise<void> {
  try {
    const teams = await FootballDataService.getTeams();
    res.json(teams);
  } catch (error) {
    console.error('World Cup teams error:', error);
    res.status(503).json({ error: 'שגיאה בטעינת נבחרות' });
  }
}

export async function getStandings(req: Request, res: Response): Promise<void> {
  try {
    const standings = await FootballDataService.getStandings();
    res.json(standings);
  } catch (error) {
    console.error('World Cup standings error:', error);
    res.status(503).json({ error: 'שגיאה בטעינת טבלאות' });
  }
}

export async function getTopScorers(req: Request, res: Response): Promise<void> {
  try {
    const scorers = await FootballDataService.getTopScorers();
    res.json(scorers);
  } catch (error) {
    console.error('World Cup scorers error:', error);
    res.status(503).json({ error: 'שגיאה בטעינת מלכי השערים' });
  }
}

export async function getDashboard(req: Request, res: Response): Promise<void> {
  try {
    const dashboard = await FootballDataService.getDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error('World Cup dashboard error:', error);
    res.status(503).json({ error: 'שגיאה בטעינת לוח הבית' });
  }
}

export async function getKnockout(req: Request, res: Response): Promise<void> {
  try {
    const matches = await FootballDataService.getKnockoutMatches();
    res.json(matches);
  } catch (error) {
    console.error('World Cup knockout error:', error);
    res.status(503).json({ error: 'שגיאה בטעינת שלב הנוקאאוט' });
  }
}
