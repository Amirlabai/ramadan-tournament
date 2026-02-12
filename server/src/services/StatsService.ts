import { Team, IPlayer } from '../models/Team';
import { Match, IMatch } from '../models/Match';

export interface StandingsEntry {
    teamId: number;
    teamName: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDiff: number;
    points: number;
}

export interface TopScorer {
    memberId: number;
    name: string;
    team: string;
    position: string;
    goals: number;
}

export interface PlayerStats {
    memberId: number;
    goals: number;
    gamesPlayed: number;
}

export class StatsService {
    /**
     * Calculate team standings from group stage matches
     */
    static async calculateStandings(): Promise<StandingsEntry[]> {
        const teams = await Team.find();
        const matches = await Match.find({ phase: 'group' });

        // Initialize standings
        const standings: { [key: number]: StandingsEntry } = {};

        teams.forEach((team) => {
            standings[team.id] = {
                teamId: team.id,
                teamName: team.name,
                played: 0,
                won: 0,
                drawn: 0,
                lost: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                goalDiff: 0,
                points: 0,
            };
        });

        // Process matches
        for (const match of matches) {
            if (match.score1 == null || match.score2 == null) continue;

            const team1 = standings[match.team1Id];
            const team2 = standings[match.team2Id];

            if (!team1 || !team2) continue;

            // Update matches played
            team1.played += 1;
            team2.played += 1;

            // Update goals
            team1.goalsFor += match.score1;
            team1.goalsAgainst += match.score2;
            team2.goalsFor += match.score2;
            team2.goalsAgainst += match.score1;

            // Determine result
            if (match.score1 > match.score2) {
                team1.won += 1;
                team1.points += 3;
                team2.lost += 1;
            } else if (match.score1 < match.score2) {
                team2.won += 1;
                team2.points += 3;
                team1.lost += 1;
            } else {
                team1.drawn += 1;
                team1.points += 1;
                team2.drawn += 1;
                team2.points += 1;
            }
        }

        // Calculate goal difference and sort
        const standingsList = Object.values(standings).map((entry) => ({
            ...entry,
            goalDiff: entry.goalsFor - entry.goalsAgainst,
        }));

        // Sort by points, then goal diff, then goals for
        standingsList.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
            return b.goalsFor - a.goalsFor;
        });

        return standingsList;
    }

    /**
     * Calculate top scorers from all matches
     */
    static async calculateTopScorers(): Promise<TopScorer[]> {
        const teams = await Team.find();
        const matches = await Match.find();

        // Create member index
        const members: { [key: number]: { name: string; team: string; position: string } } = {};
        teams.forEach((team) => {
            team.players.forEach((player) => {
                members[player.memberId] = {
                    name: `${player.firstName} ${player.lastName}`.trim() || player.nickname,
                    team: team.name,
                    position: player.position,
                };
            });
        });

        // Count goals
        const scorerStats: { [key: number]: TopScorer } = {};

        matches.forEach((match) => {
            match.goals.forEach((goal) => {
                const memberId = goal.memberId;
                const memberInfo = members[memberId];

                if (!scorerStats[memberId]) {
                    scorerStats[memberId] = {
                        memberId,
                        name: memberInfo?.name || 'Unknown',
                        team: memberInfo?.team || 'Unknown',
                        position: memberInfo?.position || 'Unknown',
                        goals: 0,
                    };
                }
                scorerStats[memberId].goals += 1;
            });
        });

        // Sort by goals
        const topScorers = Object.values(scorerStats).sort((a, b) => b.goals - a.goals);

        return topScorers;
    }

    /**
     * Calculate player statistics
     */
    static async calculatePlayerStats(): Promise<PlayerStats[]> {
        const teams = await Team.find();
        const matches = await Match.find();

        const playerStats: { [key: number]: PlayerStats } = {};

        // Initialize all players
        teams.forEach((team) => {
            team.players.forEach((player) => {
                playerStats[player.memberId] = {
                    memberId: player.memberId,
                    goals: 0,
                    gamesPlayed: 0,
                };
            });
        });

        // Count goals and estimate games played
        matches.forEach((match) => {
            const teamPlayers = new Set<number>();

            match.goals.forEach((goal) => {
                const memberId = goal.memberId;
                if (playerStats[memberId]) {
                    playerStats[memberId].goals += 1;
                    teamPlayers.add(memberId);
                }
            });

            // Mark games played for scorers (simplified - real system would have lineup data)
            if (match.score1 !== undefined && match.score2 !== undefined) {
                teamPlayers.forEach((memberId) => {
                    playerStats[memberId].gamesPlayed += 1;
                });
            }
        });

        return Object.values(playerStats);
    }
}
