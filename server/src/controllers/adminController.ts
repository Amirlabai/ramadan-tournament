import { Request, Response } from 'express';
import { parse } from 'csv-parse';
import { TeamRosterService } from '../services/TeamRosterService';
import { BannedWord } from '../models/BannedWord';
import { AutomationService } from '../services/AutomationService';
import fs from 'fs';
import { unlinkUpload } from '../utils/uploadPaths';

// News Automation
export const triggerAutomation = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await AutomationService.run();
        const statusCode = result.status === 'error' ? 500 : 200;
        res.status(statusCode).json(result);
    } catch (error) {
        console.error('Automation trigger error:', error);
        res.status(500).json({ status: 'error', message: (error as Error).message });
    }
};

interface PlayerCSV {
    team_name: string;
    first_name: string;
    last_name: string;
    nickname: string;
    number: string;
    position: string;
    bio: string;
    captain: string;
    personal_id: string;
    birth_year: string;
}

export const importPlayers = async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }

    const results: any[] = [];
    const teamsData: { [key: string]: any[] } = {};
    const teamIdMap: { [key: string]: number } = {};
    let nextTeamId = 1;
    let nextMemberId = 100;

    try {
        // Parse CSV
        const parser = fs
            .createReadStream(req.file.path)
            .pipe(parse({
                columns: ['team_name', 'first_name', 'last_name', 'nickname', 'number', 'position', 'bio', 'captain', 'personal_id', 'birth_year'],
                from_line: 2, // Skip header
                trim: true,
                skip_empty_lines: true,
                relax_column_count: true
            }));

        for await (const row of parser) {
            const { team_name, first_name, last_name, nickname, number, position, bio, captain, personal_id, birth_year } = row as PlayerCSV;

            if (!team_name) continue;
            if (!first_name && !last_name && !nickname) continue;

            if (!teamsData[team_name]) {
                teamsData[team_name] = [];
                // Assign team ID if not exists
                if (!teamIdMap[team_name]) {
                    teamIdMap[team_name] = nextTeamId++;
                }
            }

            const fullName = `${first_name} ${last_name}`.trim() || nickname;
            const displayNickname = nickname || (first_name || last_name);

            const teamId = teamIdMap[team_name];

            // Logic from scripts/import_players.py: member_id = team_id * 100 + number
            // If number is not provided, we need a fallback, but the Python script implies number is expected or calculated.
            // Python script: member_id = team_id * 100 + player_num

            let playerNumber = 0;
            if (number) {
                playerNumber = parseInt(number);
            } else {
                // Fallback if no number in CSV (though current CSV seems to have them)
                // We need to track used numbers for this team if dynamic assignment is needed.
                // For now, let's assume number is present or use a simple counter per team.
                playerNumber = (teamsData[team_name].length + 1);
            }

            const memberId = (teamId * 100) + playerNumber;

            teamsData[team_name].push({
                memberId: memberId,
                firstName: first_name || nickname || '-',
                lastName: last_name || '',
                nickname: displayNickname,
                number: playerNumber,
                position: position || 'מחמם ספסל',
                isCaptain: captain === '1',
                bio: bio || `משחק בעד ${team_name}`,
                personalId: personal_id || '',
                birthYear: birth_year ? parseInt(birth_year) : undefined
            });
        }

        // Update Database
        const teamsToInsert = Object.entries(teamsData).map(([name, players]) => ({
            id: teamIdMap[name],
            name,
            players,
        }));

        if (teamsToInsert.length > 0) {
            await TeamRosterService.replaceSeasonRoster(
                teamsToInsert.map((t) => ({
                    id: t.id,
                    name: t.name,
                    players: t.players,
                    logoUrl: '',
                }))
            );
        }

        // Cleanup uploaded file
        fs.unlinkSync(req.file.path);

        res.json({
            message: 'Import successful',
            teamsCount: teamsToInsert.length,
            playersCount: teamsToInsert.reduce((acc, t) => acc + t.players.length, 0)
        });

    } catch (error) {
        console.error('Import error details:', error);
        res.status(500).json({ error: 'Failed to process CSV', details: (error as Error).message });
        // Cleanup on error
        if (req.file) fs.unlinkSync(req.file.path);
    }
};

// Banned Words Management
export const getBannedWords = async (req: Request, res: Response) => {
    try {
        const bannedWords = await BannedWord.find({}).sort({ word: 1 });
        res.json(bannedWords);
    } catch (error) {
        console.error('Error fetching banned words:', error);
        res.status(500).json({ error: 'Failed to fetch banned words' });
    }
};

export const addBannedWord = async (req: Request, res: Response) => {
    try {
        const { word, language } = req.body;

        if (!word) {
            return res.status(400).json({ error: 'Word is required' });
        }

        const bannedWord = new BannedWord({
            word: word.toLowerCase().trim(),
            language: language || 'other',
        });

        await bannedWord.save();
        res.status(201).json(bannedWord);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Word already exists in banned list' });
        }
        console.error('Error adding banned word:', error);
        res.status(500).json({ error: 'Failed to add banned word' });
    }
};

export const removeBannedWord = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await BannedWord.deleteById(id);

        if (!result) {
            return res.status(404).json({ error: 'Banned word not found' });
        }

        res.json({ message: 'Banned word removed successfully' });
    } catch (error) {
        console.error('Error removing banned word:', error);
        res.status(500).json({ error: 'Failed to remove banned word' });
    }
};

// Comment Management
export const getAllComments = async (req: Request, res: Response) => {
    try {
        const { Comment } = await import('../models/Comment');
        const comments = await Comment.find({})
            .sort({ createdAt: -1 })
            .limit(500);

        res.json(comments);
    } catch (error) {
        console.error('Error fetching all comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
};

export const deleteComment = async (req: Request, res: Response) => {
    try {
        const { Comment } = await import('../models/Comment');
        const { id } = req.params;
        const result = await Comment.deleteById(id);

        if (!result) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
};

export const deletePlayerPhoto = async (req: Request, res: Response) => {
    try {
        const { teamId, memberId } = req.body;
        const team = await TeamRosterService.findTeamWithPlayersById(teamId);

        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        const player = team.players.find(p => p.memberId === memberId);
        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }

        if (!player.head_photo) {
            return res.status(400).json({ error: 'Player does not have a photo' });
        }

        // Delete the file if it's local (repo + disk)
        unlinkUpload(player.head_photo);

        player.head_photo = '';
        await TeamRosterService.saveTeam(team);
        res.json({ message: 'Photo deleted successfully' });
    } catch (error) {
        console.error('Error deleting player photo:', error);
        res.status(500).json({ error: 'Failed to delete photo' });
    }
};
