import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AdminSeasonService } from '../services/AdminSeasonService';
import { PointEntryService } from '../services/PointEntryService';
import { SeasonService } from '../services/SeasonService';
import { Division } from '@prisma/client';

export const listSeasons = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const seasons = await AdminSeasonService.listSeasons();
    res.json(seasons);
  } catch (error) {
    console.error('List seasons error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getGirlsAdminSummary = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const season = await AdminSeasonService.getGirlsSeasonSummary();
    let activeSeason = null;
    try {
      activeSeason = await SeasonService.getActiveSeason(Division.girls);
    } catch {
      // no active girls season
    }
    res.json({ season, activeSeasonId: activeSeason?.id ?? null });
  } catch (error) {
    console.error('Girls admin summary error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const createGirlsSeason = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { yearMonth, displayName, activate } = req.body;
    if (!yearMonth || !displayName) {
      res.status(400).json({ error: 'yearMonth and displayName are required' });
      return;
    }
    const season = await AdminSeasonService.createGirlsSeason({
      yearMonth: String(yearMonth),
      displayName: String(displayName),
      activate: activate !== false,
    });
    res.status(201).json(season);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('Create girls season error:', error);
    res.status(400).json({ error: message });
  }
};

export const activateSeason = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const season = await AdminSeasonService.activateSeason(req.params.seasonId);
    res.json(season);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('Activate season error:', error);
    res.status(400).json({ error: message });
  }
};

export const addGirlsTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const team = await AdminSeasonService.addTeam(req.params.seasonId, String(name));
    res.status(201).json(team);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('Add girls team error:', error);
    res.status(400).json({ error: message });
  }
};

export const listPointEntries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const seasonId = req.query.seasonId as string;
    if (!seasonId) {
      res.status(400).json({ error: 'seasonId query is required' });
      return;
    }
    const entries = await PointEntryService.listEntries(seasonId);
    res.json(entries);
  } catch (error) {
    console.error('List point entries error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const createPointEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { seasonId, teamId, points, note } = req.body;
    if (!seasonId || teamId === undefined || points === undefined) {
      res.status(400).json({ error: 'seasonId, teamId, and points are required' });
      return;
    }
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const parsedPoints = Number(points);
    if (!Number.isFinite(parsedPoints) || !Number.isInteger(parsedPoints)) {
      res.status(400).json({ error: 'points must be an integer' });
      return;
    }

    const result = await PointEntryService.recordEntry(
      String(seasonId),
      Number(teamId),
      parsedPoints,
      note ? String(note) : undefined,
      req.userId
    );
    res.status(201).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('Create point entry error:', error);
    res.status(400).json({ error: message });
  }
};
