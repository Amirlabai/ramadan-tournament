import { Router } from 'express';
import { getStandings, getTopScorers, getPlayerStats, getDashboard } from '../controllers/statsController';
import { Match } from '../models/Match';
import { TeamRosterService } from '../services/TeamRosterService';
import { countUnplayedGroupMatches } from '../repositories/matchQueryRepository';

const router = Router();

router.get('/', getDashboard);
router.get('/standings', getStandings);
router.get('/top-scorers', getTopScorers);
router.get('/player-stats', getPlayerStats);
router.get('/dashboard', getDashboard);
router.get('/playoffs', async (req, res) => {
    try {
        const unplayedGroupMatches = await countUnplayedGroupMatches();

        if (unplayedGroupMatches > 0) {
            return res.json([]);
        }

        const matches = await Match.find({ phase: 'knockout' }).sort({ id: 1 });
        const teams = await TeamRosterService.listTeamSummaries();
        const teamMap = new Map<number, { name: string; logoUrl?: string; logoPosition?: string }>();
        teams.forEach((t) => teamMap.set(t.id, t));

        const enriched = matches.map((m) => {
            const t1 = teamMap.get(m.team1Id);
            const t2 = teamMap.get(m.team2Id);
            return {
                ...m.toObject(),
                team1Name: t1?.name,
                team1LogoUrl: t1?.logoUrl,
                team1LogoPosition: t1?.logoPosition,
                team2Name: t2?.name,
                team2LogoUrl: t2?.logoUrl,
                team2LogoPosition: t2?.logoPosition,
            };
        });
        res.json(enriched);
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
