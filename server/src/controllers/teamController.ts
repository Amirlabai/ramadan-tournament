import { Request, Response } from 'express';
import { Division } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { TeamRosterService } from '../services/TeamRosterService';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs';
import { TeamDataService } from '../services/TeamDataService';
import { SeasonService } from '../services/SeasonService';
import { getRequestDivision, TournamentRequest } from '../middleware/tournamentDivision';
import { sanitizeTeamDescription, sanitizeTeamName } from '../utils/inputValidation';
import {
    clearPlayerProfile,
    findReservedMemberIds,
    findPendingMappingsForTeam,
    hasClaimableRosterPlayers,
    moveApprovedMappingTeam,
    rejectOtherPendingMappings,
} from '../repositories/userMappingRepository';
import { PlayerService } from '../services/PlayerService';
import { PlayerServiceError } from '../errors/PlayerServiceError';

const requestDivision = (req: Request) => getRequestDivision(req as TournamentRequest);

function slugToDivision(slug: ReturnType<typeof requestDivision>): Division {
    return slug === 'girls' ? Division.girls : Division.boys;
}

/** Which active season division owns this numeric team id (legacy mapping is id-only). */
async function divisionForLegacyMappedTeam(
    teamId: number,
    userActiveDivision: string | null | undefined
): Promise<Division | null> {
    const boysSeason = await SeasonService.getActiveSeasonForDivision(Division.boys).catch(() => null);
    const girlsSeason = await SeasonService.getActiveSeasonForDivision(Division.girls).catch(() => null);

    let inBoys = false;
    let inGirls = false;

    if (boysSeason) {
        const t = await prisma.team.findFirst({
            where: { id: teamId, seasonId: boysSeason.id },
            select: { id: true },
        });
        inBoys = !!t;
    }
    if (girlsSeason) {
        const t = await prisma.team.findFirst({
            where: { id: teamId, seasonId: girlsSeason.id },
            select: { id: true },
        });
        inGirls = !!t;
    }

    if (inBoys && !inGirls) return Division.boys;
    if (inGirls && !inBoys) return Division.girls;
    if (inBoys && inGirls) {
        if (userActiveDivision === 'girls') return Division.girls;
        if (userActiveDivision === 'boys') return Division.boys;
        return null;
    }
    return null;
}

async function isPlatformAdminUser(userId: string): Promise<boolean> {
    const user = await User.findById(userId);
    return !!user && (user.role === 'Admin' || user.role === 'admin');
}

async function canManageTeamBranding(
    userId: string,
    teamId: number,
    division: ReturnType<typeof requestDivision>
): Promise<boolean> {
    if (await isPlatformAdminUser(userId)) return true;

    const owned = await prisma.team.findFirst({
        where: { id: teamId, ownerUserId: userId, season: { division } },
        select: { id: true },
    });
    return !!owned;
}

/** Legacy map-player workflow (pre-PRD captains with memberId 0). */
async function canReviewLegacyTeamRequests(
    userId: string,
    teamId: number,
    division: ReturnType<typeof requestDivision>
): Promise<boolean> {
    if (await canManageTeamBranding(userId, teamId, division)) return true;

    const season = await SeasonService.getActiveSeasonForDivision(division).catch(() => null);
    if (!season) return false;

    const teamInDivision = await prisma.team.findFirst({
        where: { id: teamId, seasonId: season.id },
        select: { id: true },
    });
    if (!teamInDivision) return false;

    const user = await User.findById(userId);
    const mapped = user?.mappedPlayerInfo;
    if (
        !(
            mapped?.status === 'approved' &&
            mapped.teamId === teamId &&
            mapped.memberId === 0
        )
    ) {
        return false;
    }

    const divisionRow = await prisma.user.findUnique({
        where: { id: userId },
        select: { activeDivision: true },
    });
    const mappedDivision = await divisionForLegacyMappedTeam(
        mapped.teamId,
        divisionRow?.activeDivision ?? undefined
    );
    return mappedDivision === slugToDivision(division);
}

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

export const getHasClaimablePlayers = async (req: Request, res: Response): Promise<void> => {
    try {
        const division = slugToDivision(requestDivision(req));
        const hasClaimablePlayers = await hasClaimableRosterPlayers(division);
        res.json({ hasClaimablePlayers });
    } catch (error) {
        console.error('Has claimable players error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Returns players in a team that are NOT already approved-claimed by any user
export const getAvailablePlayers = async (req: Request, res: Response): Promise<void> => {
    try {
        const teamId = parseInt(req.params.id);
        const team = await TeamRosterService.findTeamWithPlayers(teamId, slugToDivision(requestDivision(req)));

        if (!team) { res.status(404).json({ error: 'Team not found' }); return; }
        if (!team.seasonId) {
            res.status(500).json({ error: 'Team season not configured' });
            return;
        }

        const claimedMemberIds = new Set(
            await findReservedMemberIds(teamId, team.seasonId)
        );

        const available = team.players
            .filter(p => !claimedMemberIds.has(p.memberId))
            .map(p => {
                const { personalId, ...rest } = p as typeof p & { personalId?: string };
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
        const division = requestDivision(req);

        if (!(await canReviewLegacyTeamRequests(req.userId!, teamId, division))) {
            res.status(403).json({ error: 'Permission denied' });
            return;
        }

        // Find users who have requested to map to this team
        const pendingUsers = await findPendingMappingsForTeam(teamId);

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
        const division = requestDivision(req);
        const { userId, status } = req.body; // status: 'approved' | 'rejected'

        if (!(await canReviewLegacyTeamRequests(req.userId!, teamId, division))) {
            res.status(403).json({ error: 'Permission denied' });
            return;
        }

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
            const teamDoc = await TeamRosterService.findTeamWithPlayers(teamId, slugToDivision(division));
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
                await TeamRosterService.saveTeam(teamDoc);
            }

            if (userToUpdate.mappedPlayerInfo.memberId > 0) {
                await rejectOtherPendingMappings(
                    userToUpdate.id,
                    teamId,
                    userToUpdate.mappedPlayerInfo.memberId,
                );
            }
        } else if (status === 'rejected') {
            // Revert role to User if they were a Player (do not downgrade Admins/Captains)
            if (userToUpdate.role === 'Player') {
                userToUpdate.role = 'User';
            }
        }

        await userToUpdate.save();

        await clearPlayerProfile(userToUpdate.id);

        const cleansedUser = await User.findById(userToUpdate.id);
        res.json({ message: `Request ${status} successfully`, user: cleansedUser });
    } catch (error) {
        console.error('Approve team request error:', error);
        res.status(500).json({ error: 'Server error processing request' });
    }
};

// Owner/admin branding: update name, description, logo position (partial PATCH — omitted fields unchanged)
export const updateTeamMetadata = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const teamId = parseInt(req.params.id);
        const { name, logoPosition, description } = req.body;

        const team = await TeamRosterService.findTeamWithPlayers(teamId, slugToDivision(requestDivision(req)));
        if (!team) {
            res.status(404).json({ error: 'קבוצה לא נמצאה' });
            return;
        }

        // PRD team owner or platform admin
        if (!(await canManageTeamBranding(req.userId!, teamId, requestDivision(req)))) {
            res.status(403).json({ error: 'אין לך הרשאה לערוך קבוצה זו' });
            return;
        }

        try {
            if (name !== undefined) team.name = sanitizeTeamName(String(name));
            if (description !== undefined) {
                team.description = sanitizeTeamDescription(String(description));
            }
        } catch (validationErr) {
            const message = validationErr instanceof Error ? validationErr.message : 'קלט לא תקין';
            res.status(400).json({ error: message });
            return;
        }

        if (logoPosition !== undefined) {
            if (!['left', 'right', 'none'].includes(logoPosition)) {
                res.status(400).json({ error: 'מיקום לוגו לא תקין' });
                return;
            }
            team.logoPosition = logoPosition;
        }

        await TeamRosterService.saveTeam(team);
        res.json({ message: 'פרטי הקבוצה עודכנו בהצלחה', team });
    } catch (error) {
        console.error('Update team metadata error:', error);
        res.status(500).json({ error: 'שגיאה בעדכון פרטי הקבוצה' });
    }
};

// Owner/admin branding: Upload team logo
export const uploadTeamLogo = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const teamId = parseInt(req.params.id);
        const file = req.file;

        if (!file) {
            res.status(400).json({ error: 'לא נבחר קובץ' });
            return;
        }

        const team = await TeamRosterService.findTeamWithPlayers(teamId, slugToDivision(requestDivision(req)));
        if (!team) {
            res.status(404).json({ error: 'קבוצה לא נמצאה' });
            return;
        }

        if (!(await canManageTeamBranding(req.userId!, teamId, requestDivision(req)))) {
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
        await TeamRosterService.saveTeam(team);

        res.json({
            message: 'לוגו הקבוצה הועלה בהצלחה',
            logoUrl: team.logoUrl
        });
    } catch (error) {
        console.error('Upload team logo error:', error);
        res.status(500).json({ error: 'שגיאה בהעלאת לוגו' });
    }
};

// Owner/admin branding: Delete team logo
export const deleteTeamLogo = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const teamId = parseInt(req.params.id);

        const team = await TeamRosterService.findTeamWithPlayers(teamId, slugToDivision(requestDivision(req)));
        if (!team) {
            res.status(404).json({ error: 'קבוצה לא נמצאה' });
            return;
        }

        if (!(await canManageTeamBranding(req.userId!, teamId, requestDivision(req)))) {
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
        await TeamRosterService.saveTeam(team);

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
        if (!req.userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        const division = requestDivision(req);
        if (!(await isPlatformAdminUser(req.userId))) {
            res.status(403).json({ error: 'Permission denied' });
            return;
        }

        const { firstName, lastName, nickname, number, position, isCaptain, birthYear, personalId } = req.body;

        if (!firstName || number == null) {
            res.status(400).json({ error: 'שם פרטי ומספר שחקן הם שדות חובה' });
            return;
        }

        const team = await TeamRosterService.findTeamWithPlayers(teamId, slugToDivision(division));
        if (!team) {
            res.status(404).json({ error: 'קבוצה לא נמצאה' });
            return;
        }

        // Generate a globally-unique memberId by scanning all teams
        const allTeams = await TeamRosterService.findAllTeamsWithPlayers(slugToDivision(division));
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
        await TeamRosterService.saveTeam(team);

        res.json({ message: 'שחקן נוסף בהצלחה', player: newPlayer });
    } catch (error) {
        console.error('Add player error:', error);
        res.status(500).json({ error: 'שגיאה בהוספת שחקן' });
    }
};

// Delete a player from a team (platform admin only)
export const deletePlayer = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const teamId = parseInt(req.params.id);
        const memberId = parseInt(req.params.memberId);

        if (!req.userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        const division = requestDivision(req);
        if (!(await isPlatformAdminUser(req.userId))) {
            res.status(403).json({ error: 'Permission denied' });
            return;
        }

        await PlayerService.deactivateRosterMember(memberId, teamId, slugToDivision(division));

        res.json({ message: 'שחקן נמחק בהצלחה' });
    } catch (error) {
        if (error instanceof PlayerServiceError) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        console.error('Delete player error:', error);
        res.status(500).json({ error: 'שגיאה במחיקת שחקן' });
    }
};

// Delete a player's head photo (platform admin only)
export const deletePlayerPhoto = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const teamId = parseInt(req.params.id);
        const memberId = parseInt(req.params.memberId);

        if (!req.userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        const division = requestDivision(req);
        if (!(await isPlatformAdminUser(req.userId))) {
            res.status(403).json({ error: 'Permission denied' });
            return;
        }

        const team = await TeamRosterService.findTeamWithPlayers(teamId, slugToDivision(division));
        if (!team) {
            res.status(404).json({ error: 'קבוצה לא נמצאה' });
            return;
        }

        const player = team.players.find((p) => p.memberId === memberId);
        if (!player) {
            res.status(404).json({ error: 'שחקן לא נמצא בקבוצה' });
            return;
        }

        if (!player.head_photo) {
            res.status(400).json({ error: 'לשחקן אין תמונה' });
            return;
        }

        const filePath = player.head_photo;
        if (filePath.startsWith('/uploads/players/')) {
            const fileName = filePath.split('/').pop();
            if (fileName) {
                const fullPath = path.join(process.cwd(), 'uploads', 'players', fileName);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
            }
        }

        player.head_photo = '';
        await TeamRosterService.saveTeam(team);

        res.json({ message: 'התמונה נמחקה בהצלחה' });
    } catch (error) {
        console.error('Delete player photo error:', error);
        res.status(500).json({ error: 'שגיאה במחיקת תמונה' });
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
            TeamRosterService.findTeamWithPlayers(sourceTeamId, slugToDivision(division)),
            TeamRosterService.findTeamWithPlayers(parseInt(targetTeamId), slugToDivision(division)),
        ]);

        if (!sourceTeam) { res.status(404).json({ error: 'קבוצת מקור לא נמצאה' }); return; }
        if (!targetTeam) { res.status(404).json({ error: 'קבוצת יעד לא נמצאה' }); return; }

        const playerIndex = sourceTeam.players.findIndex(p => p.memberId === memberId);
        if (playerIndex === -1) {
            res.status(404).json({ error: 'שחקן לא נמצא בקבוצת המקור' });
            return;
        }

        // Capture the player and remove from source
        const player = sourceTeam.players[playerIndex];
        sourceTeam.players.splice(playerIndex, 1);

        targetTeam.players.push({ ...player });

        await Promise.all([
            TeamRosterService.saveTeam(sourceTeam),
            TeamRosterService.saveTeam(targetTeam),
        ]);

        await moveApprovedMappingTeam(sourceTeamId, memberId, parseInt(targetTeamId));

        res.json({ message: 'שחקן הועבר בהצלחה', memberId });
    } catch (error) {
        console.error('Move player error:', error);
        res.status(500).json({ error: 'שגיאה בהעברת שחקן' });
    }
};

