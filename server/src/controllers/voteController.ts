import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Vote } from '../models/Vote';
import { Team } from '../models/Team';

// Cast a vote for a player
export const castVote = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { playerMemberId, category = 'mvp' } = req.body;
        const userId = req.userId;

        if (!userId) {
             res.status(401).json({ message: 'User not authenticated' });
             return;
        }

        if (!playerMemberId) {
             res.status(400).json({ message: 'Player memberId is required' });
             return;
        }

        // Verify player exists
        const playerExists = await Team.findOne({ 'players.memberId': playerMemberId });
        if (!playerExists) {
             res.status(404).json({ message: 'Player not found' });
             return;
        }

        // Check if user already voted in this category
        const existingVote = await Vote.findOne({ userId, category });
        if (existingVote) {
             // If they are clicking the same player, delete the vote (unvote)
             if (existingVote.playerMemberId === playerMemberId) {
                 await Vote.deleteOne({ _id: existingVote._id });
                 res.json({ message: 'Vote removed successfully', voted: false });
                 return;
             }

            // Update their vote if they are voting for a different player
            existingVote.playerMemberId = playerMemberId;
            await existingVote.save();
             res.json({ message: 'Vote updated successfully', vote: existingVote, voted: true });
             return;
        }

        // Cast new vote
        const vote = new Vote({
            userId,
            playerMemberId,
            category
        });

        await vote.save();

        res.status(201).json({ message: 'Vote cast successfully', vote });
    } catch (error) {
        console.error('Error casting vote:', error);
        res.status(500).json({ message: 'Error casting vote', error: error instanceof Error ? error.message : 'Unknown error' });
    }
};

// Get the current user's vote
export const getMyVote = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        const category = req.query.category as string || 'mvp';

        if (!userId) {
             res.status(401).json({ message: 'User not authenticated' });
             return;
        }

        const vote = await Vote.findOne({ userId, category });

        if (!vote) {
             res.json({ voted: false });
             return;
        }

        res.json({
            voted: true,
            playerMemberId: vote.playerMemberId,
            category: vote.category,
            createdAt: vote.createdAt
        });
    } catch (error) {
        console.error('Error fetching user vote:', error);
        res.status(500).json({ message: 'Error fetching vote status' });
    }
};

// Get real-time vote results
export const getVoteResults = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const category = req.query.category as string || 'mvp';

        // Aggregate votes by playerMemberId
        const results = await Vote.aggregate([
            { $match: { category } },
            {
                $group: {
                    _id: '$playerMemberId',
                    votes: { $sum: 1 }
                }
            },
            { $sort: { votes: -1 } },
            { $limit: 10 } // Top 10 players
        ]);

        if (results.length === 0) {
             res.json({ leaderboard: [] });
             return;
        }

        // Populate player details from Team collection
        const memberIds = results.map(r => r._id);
        
        // Find teams that contain these players
        const teams = await Team.find({ 'players.memberId': { $in: memberIds } });
        
        const leaderboard = results.map(result => {
            // Find the team and player details
            let playerDetails = null;
            let teamName = '';

            for (const team of teams) {
                const player = team.players.find(p => p.memberId === result._id);
                if (player) {
                    playerDetails = player;
                    teamName = team.name;
                    break;
                }
            }

            return {
                memberId: result._id,
                votes: result.votes,
                player: playerDetails ? {
                    firstName: playerDetails.firstName,
                    lastName: playerDetails.lastName,
                    nickname: playerDetails.nickname,
                    number: playerDetails.number,
                } : null,
                teamName
            };
        }).filter(item => item.player !== null); // Filter out any orphaned votes

        res.json({ leaderboard });
    } catch (error) {
        console.error('Error fetching vote results:', error);
        res.status(500).json({ message: 'Error fetching vote results' });
    }
};
