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
    goalDifference: number;
    points: number;
}

export interface TopScorer {
    memberId: number;
    playerName: string;
    teamName: string;
    position: string;
    goals: number;
}

// ...



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
                goalDifference: 0,
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
            goalDifference: entry.goalsFor - entry.goalsAgainst,
        }));

        // Sort by points, then goal diff, then goals for
        standingsList.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
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

        // Create member index and team mapping
        const members: { [key: number]: { name: string; teamName: string; position: string; teamId: number } } = {};
        const teamMatchesCount: { [key: number]: number } = {};

        teams.forEach((team) => {
            teamMatchesCount[team.id] = 0;
            team.players.forEach((player) => {
                members[player.memberId] = {
                    name: `${player.firstName} ${player.lastName}`.trim() || player.nickname,
                    teamName: team.name,
                    position: player.position,
                    teamId: team.id
                };
            });
        });

        // Track games played for each team
        matches.forEach(match => {
            if (match.score1 !== null && match.score2 !== null) {
                if (teamMatchesCount[match.team1Id] !== undefined) teamMatchesCount[match.team1Id]++;
                if (teamMatchesCount[match.team2Id] !== undefined) teamMatchesCount[match.team2Id]++;
            }
        });

        // Count goals
        const scorerStats: { [key: number]: TopScorer & { gamesPlayed: number } } = {};

        matches.forEach((match) => {
            if (match.score1 === null || match.score2 === null) return;
            
            match.goals.forEach((goal) => {
                const memberId = goal.memberId;
                const memberInfo = members[memberId];

                if (!scorerStats[memberId]) {
                    scorerStats[memberId] = {
                        memberId,
                        playerName: memberInfo?.name || 'Unknown',
                        teamName: memberInfo?.teamName || 'Unknown',
                        position: memberInfo?.position || 'Unknown',
                        goals: 0,
                        gamesPlayed: memberInfo ? teamMatchesCount[memberInfo.teamId] : 0
                    };
                }
                scorerStats[memberId].goals += 1;
            });
        });

        // Sort by goals, then by average (goals / gamesPlayed)
        const topScorers = Object.values(scorerStats).sort((a, b) => {
            if (b.goals !== a.goals) return b.goals - a.goals;
            
            const avgA = a.gamesPlayed > 0 ? a.goals / a.gamesPlayed : 0;
            const avgB = b.gamesPlayed > 0 ? b.goals / b.gamesPlayed : 0;
            return avgB - avgA;
        });

        return topScorers;
    }

    /**
     * Calculate player statistics
     */
    static async calculatePlayerStats(): Promise<PlayerStats[]> {
        const teams = await Team.find();
        const matches = await Match.find();

        const playerStats: { [key: number]: PlayerStats } = {};
        const teamPlayerMap: { [key: number]: number[] } = {};

        // Initialize all players and create a map of team to player memberIds
        teams.forEach((team) => {
            teamPlayerMap[team.id] = team.players.map(p => p.memberId);
            team.players.forEach((player) => {
                playerStats[player.memberId] = {
                    memberId: player.memberId,
                    goals: 0,
                    gamesPlayed: 0,
                };
            });
        });

        // Count goals and games played
        matches.forEach((match) => {
            // Only count matches that have scores (meaning they were played)
            if (match.score1 !== null && match.score2 !== null) {
                // Increment gamesPlayed for all players on both teams
                const team1Players = teamPlayerMap[match.team1Id] || [];
                const team2Players = teamPlayerMap[match.team2Id] || [];

                team1Players.forEach(id => {
                    if (playerStats[id]) playerStats[id].gamesPlayed += 1;
                });
                team2Players.forEach(id => {
                    if (playerStats[id]) playerStats[id].gamesPlayed += 1;
                });

                // Count goals
                match.goals.forEach((goal) => {
                    const memberId = goal.memberId;
                    if (playerStats[memberId]) {
                        playerStats[memberId].goals += 1;
                    }
                });
            }
        });

        return Object.values(playerStats);
    }
}
