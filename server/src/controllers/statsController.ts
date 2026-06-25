import { Request, Response } from 'express';
import { StatsService } from '../services/StatsService';
import { News } from '../models/News';
import { Match } from '../models/Match';
import { listMatches, countUnplayedGroupMatches, findNextUpcomingMatchDate } from '../repositories/matchQueryRepository';
import { Team } from '../models/Team';

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
        const [teams, topScorers] = await Promise.all([
            Team.find().select('id name logoUrl logoPosition'),
            StatsService.calculateTopScorers()
        ]);

        // Create a map of team ID to full team data for match enrichment
        const teamMap = new Map<number, any>();
        teams.forEach(team => {
            teamMap.set(team.id, {
                name: team.name,
                logoUrl: (team as any).logoUrl,
                logoPosition: (team as any).logoPosition || 'right'
            });
        });

        // Find the date of the next upcoming match
        const nextDate = await findNextUpcomingMatchDate();

        let nextMatches: any[] = [];

        if (nextDate) {
            const date = new Date(nextDate);

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

            const rawNextMatches = await listMatches({
                dateFrom: startOfDay,
                dateTo: endOfDay,
                sortField: 'date',
                sortDirection: 'asc',
                includeCommentCount: true,
            });

            nextMatches = rawNextMatches.map(match => {
                const t1 = teamMap.get(match.team1Id);
                const t2 = teamMap.get(match.team2Id);
                return {
                    ...match,
                    team1Name: t1?.name || `קבוצה ${match.team1Id}`,
                    team1LogoUrl: t1?.logoUrl,
                    team1LogoPosition: t1?.logoPosition,
                    team2Name: t2?.name || `קבוצה ${match.team2Id}`,
                    team2LogoUrl: t2?.logoUrl,
                    team2LogoPosition: t2?.logoPosition
                };
            });
        }

        const recentMatchesWithComments = await listMatches({
            finishedOnly: true,
            sortField: 'date',
            sortDirection: 'desc',
            limit: 5,
            includeCommentCount: true,
        });

        const enrichedRecentMatches = recentMatchesWithComments.map((match: any) => {
            const t1 = teamMap.get(match.team1Id);
            const t2 = teamMap.get(match.team2Id);
            return {
                ...match,
                team1Name: t1?.name || `קבוצה ${match.team1Id}`,
                team1LogoUrl: t1?.logoUrl,
                team1LogoPosition: t1?.logoPosition,
                team2Name: t2?.name || `קבוצה ${match.team2Id}`,
                team2LogoUrl: t2?.logoUrl,
                team2LogoPosition: t2?.logoPosition
            };
        });

        const unplayedGroupMatches = await countUnplayedGroupMatches();

        const isGroupPhaseComplete = unplayedGroupMatches === 0;

        const playoffMatchesRaw = isGroupPhaseComplete ? await Match.find({ phase: 'knockout' }).sort({ id: 1 }) : [];
        const enrichedPlayoffMatches = playoffMatchesRaw.map(match => {
            const t1 = teamMap.get(match.team1Id);
            const t2 = teamMap.get(match.team2Id);
            return {
                ...match.toObject(),
                team1Name: t1?.name || `קבוצה ${match.team1Id}`,
                team1LogoUrl: t1?.logoUrl,
                team1LogoPosition: t1?.logoPosition,
                team2Name: t2?.name || `קבוצה ${match.team2Id}`,
                team2LogoUrl: t2?.logoUrl,
                team2LogoPosition: t2?.logoPosition
            };
        });

        res.json({
            topScorers: topScorers.slice(0, 3),
            nextMatches,
            recentMatches: enrichedRecentMatches,
            playoffMatches: enrichedPlayoffMatches,
            teams
        });
    } catch (error) {
        console.error('Get dashboard error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
