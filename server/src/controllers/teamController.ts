import { Request, Response } from 'express';
import { Team } from '../models/Team';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs';
import { TeamDataService } from '../services/TeamDataService';
import { getRequestDivision, TournamentRequest } from '../middleware/tournamentDivision';

const requestDivision = (req: Request) => getRequestDivision(req as TournamentRequest);

export const getTeams = async (req: Request, res: Response): Promise<void> => {
    try {
        const division = getRequestDivision(req as TournamentRequest);
        const sanitizedTeams = await TeamDataService.getTeamsDocument(division);
        res.json(sanitizedTeams);
    } catch (error) {
        console.error('Get teams error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const getTeamById = async (req: Request, res: Response): Promise<void> => {
    try {
        const division = getRequestDivision(req as TournamentRequest);
        const team = await TeamDataService.getTeamById(parseInt(req.params.id), division);
        if (!team) {
            res.status(404).json({ error: 'Team not found' });
            return;
        }
        res.json(team);
    } catch (error) {
        console.error('Get team error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Returns players in a team that are NOT already approved-claimed by any user
export const getAvailablePlayers = async (req: Request, res: Response): Promise<void> => {
    try {
        const teamId = parseInt(req.params.id);
        const team = await Team.findOne({ id: teamId }, requestDivision(req));

        if (!team) { res.status(404).json({ error: 'Team not found' }); return; }

        // Get all memberIds that are already approved-claimed
        const claimedUsers = await User.find({
            'mappedPlayerInfo.teamId': teamId,
            'mappedPlayerInfo.status': 'approved',
            'mappedPlayerInfo.memberId': { $gt: 0 }
        }).select('mappedPlayerInfo.memberId');

        const claimedMemberIds = new Set(claimedUsers.map(u => u.mappedPlayerInfo!.memberId));

        const available = team.players
            .filter(p => !claimedMemberIds.has(p.memberId))
            .map(p => {
                const obj = (p as any).toObject();
                const { personalId, ...rest } = obj;
                return rest;
            });

        res.json(available);
    } catch (error) {
        console.error('Get available players error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get pending mapping requests for a specific team
export const getTeamRequests = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const teamId = parseInt(req.params.id);

        // Find users who have requested to map to this team
        const pendingUsers = await User.find({
            'mappedPlayerInfo.teamId': teamId,
            'mappedPlayerInfo.status': 'pending'
        }).select('displayName email avatarUrl mappedPlayerInfo');

        res.json(pendingUsers);
    } catch (error) {
        console.error('Get team requests error:', error);
        res.status(500).json({ error: 'Server error fetching requests' });
    }
};

// Approve or reject a mapping request
export const approveTeamRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const teamId = parseInt(req.params.id);
        const { userId, status } = req.body; // status: 'approved' | 'rejected'

        if (!userId || !['approved', 'rejected'].includes(status)) {
            res.status(400).json({ error: 'Valid userId and status (approved/rejected) required' });
            return;
        }

        const userToUpdate = await User.findById(userId);

        if (!userToUpdate || !userToUpdate.mappedPlayerInfo || userToUpdate.mappedPlayerInfo.teamId !== teamId) {
            res.status(404).json({ error: 'Mapping request not found for this team' });
            return;
        }

        userToUpdate.mappedPlayerInfo.status = status;

        if (status === 'approved') {
            userToUpdate.role = 'Player';

            const teamDoc = await Team.findOne({ id: teamId }, requestDivision(req));
            if (teamDoc) {
                let activeMemberId = userToUpdate.mappedPlayerInfo.memberId;

                // If it's a custom player request (memberId is 0), create a new player record
                if (activeMemberId === 0 && userToUpdate.playerProfile) {
                    const newMemberId = teamDoc.players.length > 0
                        ? Math.max(...teamDoc.players.map(p => p.memberId || 0)) + 1
                        : 1;

                    const newPlayer = {
                        memberId: newMemberId,
                        firstName: userToUpdate.playerProfile.firstName || '',
                        lastName: userToUpdate.playerProfile.lastName || '',
                        nickname: userToUpdate.playerProfile.nickname || '',
                        number: userToUpdate.playerProfile.number || 0,
                        position: userToUpdate.playerProfile.position || '',
                        hasPersonalId: false,
                        birthYear: 0,
                        head_photo: userToUpdate.avatarUrl || '', // Apply photo immediately on creation
                        bio: ''
                    };

                    teamDoc.players.push(newPlayer as any);

                    // Update user's mapping to the newly created ID
                    userToUpdate.mappedPlayerInfo.memberId = newMemberId;
                    activeMemberId = newMemberId;
                } else {
                    // It's an existing player claim, sync photos between user and team record
                    const playerIndex = teamDoc.players.findIndex(p => p.memberId === activeMemberId);
                    if (playerIndex !== -1) {
                        const player = teamDoc.players[playerIndex] as any;
                        if (player.head_photo) {
                            // Inherit player's existing photo to the user 
                            userToUpdate.avatarUrl = player.head_photo;
                        } else if (userToUpdate.avatarUrl) {
                            // If player has no photo, but the user does, push user's photo to the team roster
                            player.head_photo = userToUpdate.avatarUrl;
                        }
                    }
                }

                // Mark the team array as modified and save
                teamDoc.markModified('players');
                await teamDoc.save();
            }

            // Auto reject any other pending requests for the same player (unless it's a brand new custom player that no one else could've requested)
            if (userToUpdate.mappedPlayerInfo.memberId > 0) {
                await User.updateMany(
                    {
                        _id: { $ne: userToUpdate._id },
                        'mappedPlayerInfo.teamId': teamId,
                        'mappedPlayerInfo.memberId': userToUpdate.mappedPlayerInfo.memberId,
                        'mappedPlayerInfo.status': 'pending'
                    },
                    {
                        $set: { 'mappedPlayerInfo.status': 'rejected' }
                    }
                );
            }
        } else if (status === 'rejected') {
            // Revert role to User if they were a Player (do not downgrade Admins/Captains)
            if (userToUpdate.role === 'Player') {
                userToUpdate.role = 'User';
            }
        }

        await userToUpdate.save();

        // Always forcefully wipe the embedded playerProfile data because the Team record is now the source of truth,
        // or if rejected, the data shouldn't exist anyway.
        await User.updateOne({ _id: userToUpdate._id }, { $unset: { playerProfile: "" } });

        // Re-fetch the user to return the cleansed data back to the client
        const cleansedUser = await User.findById(userToUpdate._id);
        res.json({ message: `Request ${status} successfully`, user: cleansedUser });
    } catch (error) {
        console.error('Approve team request error:', error);
        res.status(500).json({ error: 'Server error processing request' });
    }
};

// Captain tool: Update team metadata (name, logo orientation)
export const updateTeamMetadata = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const teamId = parseInt(req.params.id);
        const { name, logoPosition } = req.body;

        const team = await Team.findOne({ id: teamId }, requestDivision(req));
        if (!team) {
            res.status(404).json({ error: 'קבוצה לא נמצאה' });
            return;
        }

        // Verify the user is the Captain of this team (Admins also allowed)
        const user = await User.findById(req.userId!);
        const isCaptainOfThisTeam = user?.role === 'Captain' && user.mappedPlayerInfo?.teamId === teamId;
        const isAdmin = user?.role === 'Admin' || user?.role === 'admin';

        if (!isCaptainOfThisTeam && !isAdmin) {
            res.status(403).json({ error: 'אין לך הרשאה לערוך קבוצה זו' });
            return;
        }

        if (name) team.name = name;
        if (logoPosition) {
            if (!['left', 'right', 'none'].includes(logoPosition)) {
                res.status(400).json({ error: 'מיקום לוגו לא תקין' });
                return;
            }
            team.logoPosition = logoPosition;
        }

        await team.save();
        res.json({ message: 'פרטי הקבוצה עודכנו בהצלחה', team });
    } catch (error) {
        console.error('Update team metadata error:', error);
        res.status(500).json({ error: 'שגיאה בעדכון פרטי הקבוצה' });
    }
};

// Captain tool: Upload team logo
export const uploadTeamLogo = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const teamId = parseInt(req.params.id);
        const file = req.file;

        if (!file) {
            res.status(400).json({ error: 'לא נבחר קובץ' });
            return;
        }

        const team = await Team.findOne({ id: teamId }, requestDivision(req));
        if (!team) {
            res.status(404).json({ error: 'קבוצה לא נמצאה' });
            return;
        }

        // Verify the user is the Captain of this team (Admins also allowed)
        const user = await User.findById(req.userId!);
        const isCaptainOfThisTeam = user?.role === 'Captain' && user.mappedPlayerInfo?.teamId === teamId;
        const isAdmin = user?.role === 'Admin' || user?.role === 'admin';

        if (!isCaptainOfThisTeam && !isAdmin) {
            res.status(403).json({ error: 'אין לך הרשאה לערוך קבוצה זו' });
            return;
        }

        // Create uploads directory if it doesn't exist
        const uploadDir = path.join(process.cwd(), 'uploads', 'logos');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileName = `team_${teamId}_${Date.now()}${path.extname(file.originalname)}`;
        const filePath = path.join(uploadDir, fileName);

        // Move file from temp to final location.
        // fs.renameSync fails on Render (EXDEV) because /tmp and /uploads are on different
        // file systems. copyFileSync works across devices; unlink cleans up the temp file.
        fs.copyFileSync(file.path, filePath);
        fs.unlinkSync(file.path);

        // Update team logo URL
        team.logoUrl = `/uploads/logos/${fileName}`;
        await team.save();

        res.json({
            message: 'לוגו הקבוצה הועלה בהצלחה',
            logoUrl: team.logoUrl
        });
    } catch (error) {
        console.error('Upload team logo error:', error);
        res.status(500).json({ error: 'שגיאה בהעלאת לוגו' });
    }
};

// Admin/Captain tool: Delete team logo
export const deleteTeamLogo = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const teamId = parseInt(req.params.id);

        const team = await Team.findOne({ id: teamId }, requestDivision(req));
        if (!team) {
            res.status(404).json({ error: 'קבוצה לא נמצאה' });
            return;
        }

        // Verify the user is the Captain of this team (Admins also allowed)
        const user = await User.findById(req.userId!);
        const isCaptainOfThisTeam = user?.role === 'Captain' && user.mappedPlayerInfo?.teamId === teamId;
        const isAdmin = user?.role === 'Admin' || user?.role === 'admin';

        if (!isCaptainOfThisTeam && !isAdmin) {
            res.status(403).json({ error: 'אין לך הרשאה לערוך קבוצה זו' });
            return;
        }

        // Delete physical file if it exists
        if (team.logoUrl) {
            const filePath = path.join(process.cwd(), team.logoUrl.replace(/^\//, ''));
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // Update team logo URL
        team.logoUrl = undefined;
        await team.save();

        res.json({ message: 'הלוגו נמחק בהצלחה' });
    } catch (error) {
        console.error('Delete team logo error:', error);
        res.status(500).json({ error: 'שגיאה במחיקת הלוגו' });
    }
};

// Admin tool: Add a new player to a team
export const addPlayer = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const teamId = parseInt(req.params.id);
        const { firstName, lastName, nickname, number, position, isCaptain, birthYear, personalId } = req.body;

        if (!firstName || number == null) {
            res.status(400).json({ error: 'שם פרטי ומספר שחקן הם שדות חובה' });
            return;
        }

        const division = requestDivision(req);
        const team = await Team.findOne({ id: teamId }, division);
        if (!team) {
            res.status(404).json({ error: 'קבוצה לא נמצאה' });
            return;
        }

        // Generate a globally-unique memberId by scanning all teams
        const allTeams = await Team.find({}, division);
        const allMemberIds = allTeams.flatMap(t => t.players.map(p => p.memberId));
        const maxId = allMemberIds.length > 0 ? Math.max(...allMemberIds) : 0;
        const newMemberId = maxId + 1;

        const newPlayer: any = {
            memberId: newMemberId,
            firstName: firstName.trim(),
            lastName: (lastName || '').trim(),
            nickname: (nickname || '').trim(),
            number: Number(number),
            position: (position || '').trim(),
            isCaptain: !!isCaptain,
            head_photo: '',
            bio: '',
            birthYear: birthYear ? Number(birthYear) : undefined,
            personalId: personalId ? String(personalId).trim() : undefined,
        };

        team.players.push(newPlayer);
        team.markModified('players');
        await team.save();

        res.json({ message: 'שחקן נוסף בהצלחה', player: newPlayer });
    } catch (error) {
        console.error('Add player error:', error);
        res.status(500).json({ error: 'שגיאה בהוספת שחקן' });
    }
};

// Admin tool: Delete a player from a team
export const deletePlayer = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const teamId = parseInt(req.params.id);
        const memberId = parseInt(req.params.memberId);

        const team = await Team.findOne({ id: teamId }, requestDivision(req));
        if (!team) {
            res.status(404).json({ error: 'קבוצה לא נמצאה' });
            return;
        }

        const playerIndex = team.players.findIndex(p => p.memberId === memberId);
        if (playerIndex === -1) {
            res.status(404).json({ error: 'שחקן לא נמצא בקבוצה' });
            return;
        }

        team.players.splice(playerIndex, 1);
        team.markModified('players');
        await team.save();

        // Clear any user mappings pointing to this deleted player so no orphaned accounts remain
        await User.updateMany(
            { 'mappedPlayerInfo.teamId': teamId, 'mappedPlayerInfo.memberId': memberId },
            { $set: { role: 'User' }, $unset: { mappedPlayerInfo: '' } }
        );

        res.json({ message: 'שחקן נמחק בהצלחה' });
    } catch (error) {
        console.error('Delete player error:', error);
        res.status(500).json({ error: 'שגיאה במחיקת שחקן' });
    }
};

// Admin tool: Move a player from one team to another
export const movePlayer = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const sourceTeamId = parseInt(req.params.id);
        const memberId = parseInt(req.params.memberId);
        const { targetTeamId } = req.body;

        if (!targetTeamId || targetTeamId === sourceTeamId) {
            res.status(400).json({ error: 'נדרשת קבוצת יעד שונה מקבוצת המקור' });
            return;
        }

        const division = requestDivision(req);
        const [sourceTeam, targetTeam] = await Promise.all([
            Team.findOne({ id: sourceTeamId }, division),
            Team.findOne({ id: parseInt(targetTeamId) }, division),
        ]);

        if (!sourceTeam) { res.status(404).json({ error: 'קבוצת מקור לא נמצאה' }); return; }
        if (!targetTeam) { res.status(404).json({ error: 'קבוצת יעד לא נמצאה' }); return; }

        const playerIndex = sourceTeam.players.findIndex(p => p.memberId === memberId);
        if (playerIndex === -1) {
            res.status(404).json({ error: 'שחקן לא נמצא בקבוצת המקור' });
            return;
        }

        // Capture the player and remove from source
        const playerObj: any = (sourceTeam.players[playerIndex] as any).toObject();
        sourceTeam.players.splice(playerIndex, 1);
        sourceTeam.markModified('players');

        // memberIds are globally unique — keep the original ID so match goal records stay intact
        targetTeam.players.push(playerObj);
        targetTeam.markModified('players');

        await Promise.all([sourceTeam.save(), targetTeam.save()]);

        // Update any approved user mapping to reflect the new team
        await User.updateMany(
            { 'mappedPlayerInfo.teamId': sourceTeamId, 'mappedPlayerInfo.memberId': memberId },
            { $set: { 'mappedPlayerInfo.teamId': parseInt(targetTeamId) } }
        );

        res.json({ message: 'שחקן הועבר בהצלחה', memberId });
    } catch (error) {
        console.error('Move player error:', error);
        res.status(500).json({ error: 'שגיאה בהעברת שחקן' });
    }
};

