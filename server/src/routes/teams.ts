import { Router } from 'express';
import os from 'os';
import multer from 'multer';
import {
    getTeams,
    getTeamById,
    getAvailablePlayers,
    getTeamRequests,
    approveTeamRequest,
    updateTeamMetadata,
    uploadTeamLogo,
    deleteTeamLogo,
    addPlayer,
    deletePlayer,
    movePlayer,
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
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const upload = multer({ dest: os.tmpdir() });

router.get('/', getTeams);
router.get('/available', authenticate, listAvailableTeams);
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
router.get('/:id/requests', authenticate, authorize(['Admin', 'admin', 'Captain']), getTeamRequests);
router.post('/:id/requests', authenticate, authorize(['Admin', 'admin', 'Captain']), approveTeamRequest);

// Captain tools: Metadata & Logo
router.patch('/:id/metadata', authenticate, authorize(['Admin', 'admin', 'Captain']), updateTeamMetadata);
router.post('/:id/logo', authenticate, authorize(['Admin', 'admin', 'Captain']), upload.single('logo'), uploadTeamLogo);
router.delete('/:id/logo', authenticate, authorize(['Admin', 'admin', 'Captain']), deleteTeamLogo);

// Admin tools: Player management
router.post('/:id/players', authenticate, authorize(['Admin', 'admin']), addPlayer);
router.delete('/:id/players/:memberId', authenticate, authorize(['Admin', 'admin']), deletePlayer);
router.patch('/:id/players/:memberId/move', authenticate, authorize(['Admin', 'admin']), movePlayer);

export default router;
