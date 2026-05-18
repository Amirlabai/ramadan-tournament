import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { NewsDataService } from '../services/NewsDataService';
import { getRequestDivision, TournamentRequest } from '../middleware/tournamentDivision';

// Public: Get all news
export const getAllNews = async (req: Request, res: Response): Promise<void> => {
    try {
        const division = getRequestDivision(req as TournamentRequest);
        const news = await NewsDataService.getAllNews(division);
        res.json(news);
    } catch (error) {
        console.error('Get news error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Admin: Create news
export const createNews = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const division = getRequestDivision(req as TournamentRequest);
        const news = await NewsDataService.createNews(division, req.body, req.userId);
        res.status(201).json(news);
    } catch (error) {
        console.error('Create news error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Admin: Update news
export const updateNews = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const division = getRequestDivision(req as TournamentRequest);
        const news = await NewsDataService.updateNews(
            division,
            parseInt(req.params.id, 10),
            req.body
        );
        res.json(news);
    } catch (error) {
        console.error('Update news error:', error);
        if ((error as { code?: string }).code === 'P2025') {
            res.status(404).json({ error: 'News not found' });
            return;
        }
        res.status(500).json({ error: 'Server error' });
    }
};

// Admin: Delete news
export const deleteNews = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const division = getRequestDivision(req as TournamentRequest);
        await NewsDataService.deleteNews(division, parseInt(req.params.id, 10));
        res.json({ message: 'News deleted successfully' });
    } catch (error) {
        console.error('Delete news error:', error);
        if ((error as { code?: string }).code === 'P2025') {
            res.status(404).json({ error: 'News not found' });
            return;
        }
        res.status(500).json({ error: 'Server error' });
    }
};
