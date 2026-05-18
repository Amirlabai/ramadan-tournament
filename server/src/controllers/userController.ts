import { Response } from 'express';
import { User } from '../models/User';
import { Team } from '../models/Team';
import { AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env';
import { sendTeamRequestNotification, sendPlayerMappingNotification } from '../services/emailService';

// Voluntary leave team
export const leaveTeam = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = await User.findById(req.userId!);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        if (!user.mappedPlayerInfo) {
            res.status(400).json({ error: 'משתמש לא משויך לקבוצה' });
            return;
        }

        if (user.role === 'Captain') {
            res.status(403).json({ error: 'קפטן לא יכול לעזוב את הקבוצה שלו (Captain sinks with the ship)' });
            return;
        }

        // Clear mapping
        user.mappedPlayerInfo = undefined;

        // Revert role to User if they were a Player
        if (user.role === 'Player') {
            user.role = 'User';
        }

        await user.save();
        res.json({ message: 'עזבת את הקבוצה בהצלחה' });
    } catch (error) {
        console.error('Leave team error:', error);
        res.status(500).json({ error: 'שגיאה בשרת בעת עזיבת הקבוצה' });
    }
};

export const requestPlayerMapping = async (_req: AuthRequest, res: Response): Promise<void> => {
    res.status(410).json({
        error: 'שיוך שחקן ישן הוסר. השתמש ב"בקשת הצטרפות" מעמוד הקבוצות.',
        code: 'LEGACY_MAP_PLAYER_DEPRECATED',
    });
};

// ── User edits their own player info ─────────────────────────────────────────
export const updatePlayerProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = await User.findById(req.userId!);
        if (!user) { res.status(404).json({ error: 'User not found' }); return; }

        if (!user.mappedPlayerInfo) {
            res.status(400).json({ error: 'No player mapping found' });
            return;
        }

        const { teamId, memberId, status } = user.mappedPlayerInfo;
        const { firstName, lastName, nickname, number, position, bio } = req.body;

        // Flow A: Approved Player - update the Team record directly
        if (memberId > 0 && status === 'approved') {
            const team = await Team.findOne({ id: teamId });
            if (!team) {
                res.status(404).json({ error: 'Team not found' });
                return;
            }

            const playerIndex = team.players.findIndex(p => p.memberId === memberId);
            if (playerIndex === -1) {
                res.status(404).json({ error: 'Player slot not found in team' });
                return;
            }

            // Update only provided fields, falling back to existing team data
            const player = team.players[playerIndex];
            player.firstName = firstName != null ? String(firstName).trim().slice(0, 50) : player.firstName;
            player.lastName = lastName != null ? String(lastName).trim().slice(0, 50) : player.lastName;
            player.nickname = nickname != null ? String(nickname).trim().slice(0, 50) : player.nickname;
            player.number = number != null ? Number(number) : player.number;
            player.position = position != null ? String(position).trim().slice(0, 30) : player.position;
            if (bio != null) player.bio = String(bio).trim().slice(0, 300);

            team.markModified('players');
            await team.save();

            res.json({ message: 'Player profile updated in Team database', playerProfile: player });
            return;
        }

        // Flow B: Pending Custom Player - update the local User.playerProfile draft
        const updatedPendingProfile = {
            firstName: firstName != null ? String(firstName).trim().slice(0, 50) : user.playerProfile?.firstName ?? '',
            lastName: lastName != null ? String(lastName).trim().slice(0, 50) : user.playerProfile?.lastName ?? '',
            nickname: nickname != null ? String(nickname).trim().slice(0, 50) : user.playerProfile?.nickname ?? '',
            number: number != null ? Number(number) : user.playerProfile?.number,
            position: position != null ? String(position).trim().slice(0, 30) : user.playerProfile?.position ?? '',
            bio: bio != null ? String(bio).trim().slice(0, 300) : user.playerProfile?.bio ?? ''
        };

        user.playerProfile = updatedPendingProfile;
        await user.save();

        res.json({ message: 'Pending player profile updated', playerProfile: user.playerProfile });
    } catch (error) {
        console.error('Update player profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};


export const uploadAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const user = await User.findById(req.userId!);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Remove old avatar if it's a local upload
        if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
            const oldPath = path.join(process.cwd(), user.avatarUrl);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        const uploadsDir = path.join(process.cwd(), 'uploads', 'players');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const ext = path.extname(req.file.originalname) || '.jpg';
        const filename = `avatar_${req.userId}_${Date.now()}${ext}`;
        const finalPath = path.join(uploadsDir, filename);

        // Use copyFileSync + unlinkSync instead of renameSync.
        // renameSync fails with EXDEV on Render because /tmp and /uploads are on different file systems.
        fs.copyFileSync(req.file.path, finalPath);
        fs.unlinkSync(req.file.path);

        user.avatarUrl = `/uploads/players/${filename}`;
        await user.save();

        // If the user is an approved tournament participant, instantly sync the avatar to the Team roster
        const isMappableRole = ['Player', 'Captain', 'Admin', 'admin'].includes(user.role);
        if (isMappableRole && user.mappedPlayerInfo?.status === 'approved') {
            const team = await Team.findOne({ id: user.mappedPlayerInfo.teamId });
            if (team) {
                const pIndex = team.players.findIndex(p => p.memberId === user.mappedPlayerInfo!.memberId);
                if (pIndex !== -1) {
                    team.players[pIndex].head_photo = user.avatarUrl;
                    team.markModified('players');
                    await team.save();
                }
            }
        }

        res.json({ message: 'Avatar updated successfully', avatarUrl: user.avatarUrl });
    } catch (error) {
        console.error('Avatar upload error:', error);
        res.status(500).json({ error: 'Server error during avatar upload' });
    }
};

export const deleteAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = await User.findById(req.userId!);
        if (!user) { res.status(404).json({ error: 'User not found' }); return; }

        // Delete the local file if the current avatar is an uploaded one
        if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
            const filePath = path.join(process.cwd(), user.avatarUrl);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        // Revert to Google profile picture, or clear entirely
        user.avatarUrl = user.googlePictureUrl ?? undefined;
        await user.save();

        // If the user is an approved tournament participant, instantly sync the deletion to the Team roster
        const isMappableRole = ['Player', 'Captain', 'Admin', 'admin'].includes(user.role);
        if (isMappableRole && user.mappedPlayerInfo?.status === 'approved') {
            const team = await Team.findOne({ id: user.mappedPlayerInfo.teamId });
            if (team) {
                const pIndex = team.players.findIndex(p => p.memberId === user.mappedPlayerInfo!.memberId);
                if (pIndex !== -1) {
                    team.players[pIndex].head_photo = user.avatarUrl || '';
                    team.markModified('players');
                    await team.save();
                }
            }
        }

        res.json({ message: 'Avatar deleted', avatarUrl: user.avatarUrl ?? null });
    } catch (error) {
        console.error('Avatar delete error:', error);
        res.status(500).json({ error: 'Server error during avatar deletion' });
    }
};

export const requestTeamCreation = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { teamName, description } = req.body;
        if (!teamName?.trim()) {
            res.status(400).json({ error: 'שם קבוצה נדרש' });
            return;
        }
        const { Division } = await import('@prisma/client');
        const { RegistrationService } = await import('../services/RegistrationService');
        const request = await RegistrationService.submitTeamCreation(
            req.userId!,
            Division.boys,
            String(teamName),
            String(description ?? '')
        );
        res.json({
            message: 'בקשת הקמת קבוצה נשלחה',
            pendingTeamRequest: { teamName: request.teamName, status: 'pending' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'שגיאה בשרת';
        res.status(400).json({ error: message });
    }
};

export const getPendingTeamRequests = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const users = await User.find({ 'pendingTeamRequest.status': 'pending' })
            .select('displayName email avatarUrl role pendingTeamRequest createdAt');
        res.json(users);
    } catch (error) {
        console.error('Error fetching team requests:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const approveTeamRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const { action } = req.body; // 'approved' or 'rejected'

        // Allowlist the action value — never trust raw user input for state decisions
        if (action !== 'approved' && action !== 'rejected') {
            res.status(400).json({ error: 'Invalid action. Must be "approved" or "rejected"' });
            return;
        }

        const user = await User.findById(userId);
        if (!user || !user.pendingTeamRequest) {
            res.status(404).json({ error: 'User or team request not found' });
            return;
        }

        if (action === 'approved') {
            // Find the max team ID to assign a new one
            const maxTeam = await Team.findOne().sort({ id: -1 });
            const newTeamId = (maxTeam?.id ?? 0) + 1;

            // Create the team
            const newTeam = new Team({
                id: newTeamId,
                name: user.pendingTeamRequest.teamName,
                players: []
            });
            await newTeam.save();

            // Promote user to Captain and assign to new team
            user.role = 'Captain';
            user.mappedPlayerInfo = { teamId: newTeamId, memberId: 0, status: 'approved' };
            user.pendingTeamRequest.status = 'approved';
        } else {
            user.pendingTeamRequest.status = 'rejected';
        }

        await user.save();
        res.json({ message: `Team request ${action}` });
    } catch (error) {
        console.error('Team approval error:', error);
        res.status(500).json({ error: 'Server error during approval' });
    }
};

// ─── Admin: view & edit all user-team mappings ───────────────────────────────

export const getUserMappings = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const users = await User.find({ mappedPlayerInfo: { $exists: true } })
            .select('displayName email avatarUrl role mappedPlayerInfo playerProfile createdAt')
            .sort({ 'mappedPlayerInfo.status': 1, createdAt: -1 })
            .lean();

        // Hydrate team and player names for each user
        const teams = await Team.find({}).lean();
        const hydratedUsers = users.map(user => {
            const info = user.mappedPlayerInfo;
            if (!info) return user;

            const team = teams.find(t => t.id === info.teamId);
            const teamName = team ? team.name : `Team #${info.teamId}`;
            let playerName = 'Unknown';

            if (info.memberId > 0 && team) {
                const player = team.players.find(p => p.memberId === info.memberId);
                playerName = player ? `${player.firstName} ${player.lastName}`.trim() : `Player #${info.memberId}`;
            } else if (user.playerProfile) {
                playerName = `${user.playerProfile.firstName} ${user.playerProfile.lastName || ''} (New)`.trim();
            }

            return {
                ...user,
                resolvedTeamName: teamName,
                resolvedPlayerName: playerName
            };
        });

        res.json(hydratedUsers);
    } catch (error) {
        console.error('Get user mappings error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const updateUserMapping = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const { teamId, status, role } = req.body;

        const validStatuses = ['pending', 'approved', 'rejected'];
        const validRoles = ['User', 'Player', 'Captain', 'Admin', 'admin'];

        if (status && !validStatuses.includes(status)) {
            res.status(400).json({ error: 'Invalid status value' });
            return;
        }
        if (role && !validRoles.includes(role)) {
            res.status(400).json({ error: 'Invalid role value' });
            return;
        }

        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const oldStatus = user.mappedPlayerInfo?.status;

        if (!user.mappedPlayerInfo) {
            user.mappedPlayerInfo = { teamId: teamId ?? 0, memberId: 0, status: status ?? 'pending' };
        } else {
            if (teamId !== undefined) user.mappedPlayerInfo.teamId = Number(teamId);
            if (status) user.mappedPlayerInfo.status = status;
        }
        if (role) user.role = role;

        // Apply side effects if the admin changed the mapping status explicitly
        if (status && status !== oldStatus) {
            const currentTeamId = user.mappedPlayerInfo.teamId;

            if (status === 'approved') {
                if (!role) user.role = 'Player'; // auto-promote only if no explicit role provided

                const teamDoc = await Team.findOne({ id: currentTeamId });
                if (teamDoc) {
                    let activeMemberId = user.mappedPlayerInfo.memberId;

                    if (activeMemberId === 0 && user.playerProfile) {
                        // Use global max across ALL teams to prevent cross-team memberId collisions
                        const allTeams = await Team.find({});
                        const allIds = allTeams.flatMap(t => t.players.map((p: any) => p.memberId || 0));
                        const newMemberId = allIds.length > 0 ? Math.max(...allIds) + 1 : 1;
                        teamDoc.players.push({
                            memberId: newMemberId,
                            firstName: user.playerProfile.firstName || '',
                            lastName: user.playerProfile.lastName || '',
                            nickname: user.playerProfile.nickname || '',
                            number: user.playerProfile.number || 0,
                            position: user.playerProfile.position || '',
                            hasPersonalId: false,
                            birthYear: 0,
                            head_photo: user.avatarUrl || '',
                            bio: user.playerProfile.bio || ''
                        } as any);

                        user.mappedPlayerInfo.memberId = newMemberId;
                        activeMemberId = newMemberId;
                    } else {
                        const playerIndex = teamDoc.players.findIndex(p => p.memberId === activeMemberId);
                        if (playerIndex !== -1) {
                            const player = teamDoc.players[playerIndex] as any;
                            if (player.head_photo) {
                                user.avatarUrl = player.head_photo;
                            } else if (user.avatarUrl) {
                                player.head_photo = user.avatarUrl;
                            }
                        }
                    }
                    teamDoc.markModified('players');
                    await teamDoc.save();
                }

                if (user.mappedPlayerInfo.memberId > 0) {
                    await User.updateMany(
                        {
                            _id: { $ne: user._id },
                            'mappedPlayerInfo.teamId': currentTeamId,
                            'mappedPlayerInfo.memberId': user.mappedPlayerInfo.memberId,
                            'mappedPlayerInfo.status': 'pending'
                        },
                        { $set: { 'mappedPlayerInfo.status': 'rejected' } }
                    );
                }
            } else if (status === 'rejected') {
                if (user.role === 'Player') user.role = 'User';
            }
        }

        await user.save();

        if (status === 'approved' || status === 'rejected') {
            await User.updateOne({ _id: user._id }, { $unset: { playerProfile: "" } });
            // re-fetch to update local object reference
            const refreshed = await User.findById(user._id);
            if (refreshed) Object.assign(user, refreshed.toObject());
        }
        res.json({
            message: 'Mapping updated',
            user: {
                id: user._id,
                displayName: user.displayName,
                role: user.role,
                mappedPlayerInfo: user.mappedPlayerInfo
            }
        });
    } catch (error) {
        console.error('Update mapping error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

