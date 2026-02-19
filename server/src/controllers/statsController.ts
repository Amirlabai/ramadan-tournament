import { Request, Response } from 'express';
import { StatsService } from '../services/StatsService';
import { News } from '../models/News';
import { Match } from '../models/Match';

export const getStandings = async (req: Request, res: Response): Promise<void> => {
    try {
        const standings = await StatsService.calculateStandings();
        res.json(standings);
    } catch (error) {
        console.error('Get standings error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const getTopScorers = async (req: Request, res: Response): Promise<void> => {
    try {
        const topScorers = await StatsService.calculateTopScorers();
        res.json(topScorers);
    } catch (error) {
        console.error('Get top scorers error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const getPlayerStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const playerStats = await StatsService.calculatePlayerStats();
        res.json(playerStats);
    } catch (error) {
        console.error('Get player stats error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const getDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
        const [teams, topScorers, recentMatches] = await Promise.all([
            import('../models/Team').then(m => m.Team.find().select('id name')),
            StatsService.calculateTopScorers(),
            Match.find({ score1: { $ne: null } })
                .sort({ date: -1 })
                .limit(5)
        ]);

        // Create a map of team ID to name for match enrichment
        const teamMap = new Map<number, string>();
        teams.forEach(team => {
            teamMap.set(team.id, team.name);
        });

        // Find the date of the next upcoming match
        const nextMatchDate = await Match.findOne({ date: { $gte: new Date() } })
            .sort({ date: 1 })
            .select('date');

        let nextMatches: any[] = [];

        // Fetch all matches for that specific date
        if (nextMatchDate) {
            const date = new Date(nextMatchDate.date);

            // Set start of day in Jerusalem timezone
            // We want to find the UTC timestamp that corresponds to 00:00:00 JLM on that day
            const options: Intl.DateTimeFormatOptions = {
                timeZone: 'Asia/Jerusalem',
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour12: false
            };

            const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
            const getPart = (type: string) => parts.find(p => p.type === type)?.value;
            const year = parseInt(getPart('year')!);
            const month = parseInt(getPart('month')!);
            const day = parseInt(getPart('day')!);

            // Create a date that IS 00:00:00 in JLM, then get its UTC time.
            // Since we can't easily construct "JLM Date", we iterate or use a small helper logic
            // But for query purposes, we can approximate or just use a wide range?
            // No, strictly we want the JLM day.

            // Helper to get UTC timestamp from JLM y/m/d h:m
            const getUtcFromJlm = (y: number, m: number, d: number, h: number, min: number) => {
                const target = Date.UTC(y, m - 1, d, h, min);
                let estimated = new Date(target);
                // Adjust until it matches
                for (let i = 0; i < 3; i++) {
                    const parts = new Intl.DateTimeFormat('en-US', { ...options, hour: 'numeric', minute: 'numeric' }).formatToParts(estimated);
                    const p = (t: string) => parseInt(parts.find(x => x.type === t)?.value || '0');
                    const actual = Date.UTC(p('year'), p('month') - 1, p('day'), p('hour'), p('minute'));
                    const diff = actual - target;
                    if (diff === 0) break;
                    estimated = new Date(estimated.getTime() - diff);
                }
                return estimated;
            };

            const startOfDay = getUtcFromJlm(year, month, day, 0, 0); // 00:00 JLM
            const endOfDay = getUtcFromJlm(year, month, day, 23, 59); // 23:59 JLM

            const rawNextMatches = await Match.find({
                date: { $gte: startOfDay, $lte: endOfDay }
            }).sort({ date: 1 }).lean();

            nextMatches = rawNextMatches.map(match => ({
                ...match,
                team1Name: teamMap.get(match.team1Id) || `קבוצה ${match.team1Id}`,
                team2Name: teamMap.get(match.team2Id) || `קבוצה ${match.team2Id}`
            }));
        }

        const enrichedRecentMatches = recentMatches.map((match: any) => ({
            ...match.toObject(),
            team1Name: teamMap.get(match.team1Id) || `קבוצה ${match.team1Id}`,
            team2Name: teamMap.get(match.team2Id) || `קבוצה ${match.team2Id}`
        }));

        res.json({
            topScorer: topScorers[0] || null,
            nextMatches,
            recentMatches: enrichedRecentMatches
        });
    } catch (error) {
        console.error('Get dashboard error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
