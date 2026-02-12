import { Request, Response } from 'express';
import { News } from '../models/News';
import { AuthRequest } from '../middleware/auth';

// Public: Get all news
export const getAllNews = async (req: Request, res: Response): Promise<void> => {
    try {
        const news = await News.find().sort({ date: -1 });
        res.json(news);
    } catch (error) {
        console.error('Get news error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Admin: Create news
export const createNews = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const maxNews = await News.findOne().sort({ id: -1 });
        const nextId = (maxNews?.id || 0) + 1;

        const news = new News({
            ...req.body,
            id: nextId,
            createdBy: req.userId,
        });

        await news.save();
        res.status(201).json(news);
    } catch (error) {
        console.error('Create news error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Admin: Update news
export const updateNews = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const news = await News.findOneAndUpdate(
            { id: parseInt(req.params.id) },
            req.body,
            { new: true }
        );

        if (!news) {
            res.status(404).json({ error: 'News not found' });
            return;
        }

        res.json(news);
    } catch (error) {
        console.error('Update news error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Admin: Delete news
export const deleteNews = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const news = await News.findOneAndDelete({ id: parseInt(req.params.id) });

        if (!news) {
            res.status(404).json({ error: 'News not found' });
            return;
        }

        res.json({ message: 'News deleted successfully' });
    } catch (error) {
        console.error('Delete news error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
