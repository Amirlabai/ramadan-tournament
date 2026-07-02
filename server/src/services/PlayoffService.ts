import { Match } from '../models/Match';
import { StatsService } from './StatsService';

export class PlayoffService {
    static async syncPlayoffs(): Promise<void> {
        const standings = await StatsService.calculateStandings();

        // We need at least 8 teams for a full playoff as described
        if (standings.length < 8) {
            throw new Error(`Not enough teams for playoffs. Found ${standings.length}, need at least 8.`);
        }

        const top8 = standings.slice(0, 8);
        const teamsByRank: { [rank: number]: number } = {};
        top8.forEach((entry, index) => {
            teamsByRank[index + 1] = entry.teamId;
        });

        // Match definitions for March 17th
        const playoffDate = new Date('2026-03-17');

        // Helper to create date with specific time in Jerusalem
        const createDate = (hours: number, minutes: number) => {
            const date = new Date(playoffDate);
            // We use UTC and offset to simulate Jerusalem (UTC+2 or +3)
            // But since the server handles timezones, we'll set it properly
            date.setUTCHours(hours - 2, minutes, 0, 0); // Assuming UTC+2 for March
            return date;
        };

        const slots = [
            {
                rank1: 5, rank2: 8,
                time: { h: 20, m: 0 },
                location: 'מרכז צעירים',
                phase: 'knockout' as const,
                customId: 1001 // Unique range for playoffs
            },
            {
                rank1: 6, rank2: 7,
                time: { h: 21, m: 0 },
                location: 'מרכז צעירים',
                phase: 'knockout' as const,
                customId: 1002
            },
            {
                rank1: 2, rank2: 3,
                time: { h: 20, m: 30 },
                location: 'מגרש סינטטי מתנ״ס',
                phase: 'knockout' as const,
                customId: 1003
            },
            {
                rank1: 1, rank2: 4,
                time: { h: 21, m: 45 },
                location: 'מגרש סינטטי מתנ״ס',
                phase: 'knockout' as const,
                customId: 1004
            }
        ];

        for (const slot of slots) {
            const matchDate = createDate(slot.time.h, slot.time.m);
            const team1Id = teamsByRank[slot.rank1];
            const team2Id = teamsByRank[slot.rank2];

            const existing = await Match.findOne({ id: slot.customId });
            const teamsChanged = !!existing
                && (existing.team1Id !== team1Id || existing.team2Id !== team2Id);

            const updateBody: Record<string, unknown> = {
                id: slot.customId,
                date: matchDate,
                location: slot.location,
                phase: slot.phase,
                team1Id,
                team2Id,
            };

            if (teamsChanged) {
                updateBody.goals = [];
                updateBody.score1 = 0;
                updateBody.score2 = 0;
            }

            await Match.findOneAndUpdate(
                { id: slot.customId },
                updateBody,
                { upsert: true, new: true }
            );
        }

        // Placeholder for Finals on March 18th
        const finalsDate = new Date('2026-03-18');
        const finalsSlots = [
            { id: 2001, location: 'מגרש סינטטי מתנ״ס', time: { h: 20, m: 30 }, label: 'גמר פלייאוף תחתון' },
            { id: 2002, location: 'מגרש סינטטי מתנ״ס', time: { h: 21, m: 30 }, label: 'גמר פלייאוף עליון' }
        ];

        for (const slot of finalsSlots) {
            const matchDate = new Date(finalsDate);
            matchDate.setUTCHours(slot.time.h - 2, slot.time.m, 0, 0);

            // Finals teams are usually determined by winners of previous matches
            // For now, we create placeholders if they don't exist
            const existing = await Match.findOne({ id: slot.id });
            if (!existing) {
                await Match.create({
                    id: slot.id,
                    date: matchDate,
                    location: slot.location,
                    phase: 'knockout',
                    team1Id: 0, // Placeholder
                    team2Id: 0, // Placeholder
                    score1: null,
                    score2: null,
                    goals: []
                });
            }
        }
    }
}
