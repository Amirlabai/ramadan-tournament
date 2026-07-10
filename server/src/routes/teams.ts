import { Router } from 'express';
import os from 'os';
import multer from 'multer';
import {
    getTeams,
    getTeamById,
    getHasClaimablePlayers,
    getAvailablePlayers,
    getTeamRequests,
    approveTeamRequest,
    updateTeamMetadata,
    uploadTeamLogo,
    deleteTeamLogo,
    addPlayer,
    deletePlayer,
    movePlayer,
    updateManagedPlayer,
    uploadManagedPlayerPhoto,
    deleteManagedPlayerPhoto,
} from '../controllers/teamController';
import {
    listAvailableTeams,
    listOwnerJoinRequests,
    submitJoinRequest,
    submitTeamCreation,
    submitTransferRequest,
    ownerReviewJoin,
    setSquadRoles,
    addSelfToRoster,
} from '../controllers/registrationController';
import { authenticate, requirePlatformAdmin } from '../middleware/auth';

const router = Router();
const upload = multer({ dest: os.tmpdir() });

router.get('/', getTeams);
router.get('/available', authenticate, listAvailableTeams);
router.get('/has-claimable-players', getHasClaimablePlayers);
router.post('/creation-request', authenticate, submitTeamCreation);
router.post('/transfer-request', authenticate, submitTransferRequest);
router.get('/:id', getTeamById);
router.get('/:id/available-players', getAvailablePlayers);

router.get('/:id/join-requests-pending', authenticate, listOwnerJoinRequests);
router.post('/:id/join-request', authenticate, submitJoinRequest);
router.post('/:id/roster/add-self', authenticate, addSelfToRoster);
router.patch('/:id/squad-roles', authenticate, setSquadRoles);
router.post('/:id/owner-review-join', authenticate, ownerReviewJoin);

// Legacy captain mapping requests
router.get('/:id/requests', authenticate, getTeamRequests);
router.post('/:id/requests', authenticate, approveTeamRequest);

// Owner/captain/admin branding: metadata & logo
router.patch('/:id/metadata', authenticate, updateTeamMetadata);
router.post('/:id/logo', authenticate, upload.single('logo'), uploadTeamLogo);
router.delete('/:id/logo', authenticate, deleteTeamLogo);

// Owner/captain/admin: post-edit roster player fields & photo
router.patch('/:id/players/:memberId', authenticate, updateManagedPlayer);
router.post(
    '/:id/players/:memberId/photo',
    authenticate,
    upload.single('photo'),
    uploadManagedPlayerPhoto
);
router.delete('/:id/players/:memberId/photo', authenticate, deleteManagedPlayerPhoto);

// Roster management — platform admins only (route + controller)
router.post('/:id/players', requirePlatformAdmin, addPlayer);
router.delete('/:id/players/:memberId', requirePlatformAdmin, deletePlayer);
router.patch('/:id/players/:memberId/move', requirePlatformAdmin, movePlayer);

export default router;
