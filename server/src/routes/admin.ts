import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { importPlayers, getBannedWords, addBannedWord, removeBannedWord, getAllComments, deleteComment, deletePlayerPhoto, triggerAutomation } from '../controllers/adminController';
import { getPendingTeamRequests, approveTeamRequest } from '../controllers/userController';
import {
  listSeasons,
  getGirlsAdminSummary,
  createGirlsSeason,
  activateSeason,
  addGirlsTeam,
  listPointEntries,
  createPointEntry,
} from '../controllers/adminSeasonController';
import {
  listWorkflowQueues,
  getWorkflowPendingCount,
  searchIdentityUsers,
  assignUserIdentity,
  reviewCreationRequest,
  reviewJoinRequest,
  reviewTransferRequest,
  listCaptainCandidates,
  setTeamCaptain,
} from '../controllers/adminWorkflowController';
import { searchAdminUsers, setAdminUserRole } from '../controllers/adminUserController';
import { requirePlatformAdmin } from '../middleware/auth';
import os from 'os';

const router = Router();
const upload = multer({ dest: os.tmpdir() });

const adminSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'יותר מדי חיפושים. המתן דקה ונסה שוב.' },
});

router.post('/import-players', requirePlatformAdmin, upload.single('file'), importPlayers);

// Banned words management
router.get('/banned-words', requirePlatformAdmin, getBannedWords);
router.post('/banned-words', requirePlatformAdmin, addBannedWord);
router.delete('/banned-words/:id', requirePlatformAdmin, removeBannedWord);

// Comment management
router.get('/comments', requirePlatformAdmin, getAllComments);
router.delete('/comments/:id', requirePlatformAdmin, deleteComment);

// Photo delete (uploads are live; no approval queue)
router.post('/photos/delete', requirePlatformAdmin, deletePlayerPhoto);

// Team creation requests
router.get('/team-requests', requirePlatformAdmin, getPendingTeamRequests);
router.post('/team-requests/:userId', requirePlatformAdmin, approveTeamRequest);

// News automation
router.post('/trigger-automation', requirePlatformAdmin, triggerAutomation);

// Seasons (girls / points tournament)
router.get('/seasons', requirePlatformAdmin, listSeasons);
router.get('/seasons/girls/summary', requirePlatformAdmin, getGirlsAdminSummary);
router.post('/seasons/girls', requirePlatformAdmin, createGirlsSeason);
router.post('/seasons/:seasonId/activate', requirePlatformAdmin, activateSeason);
router.post('/seasons/:seasonId/teams', requirePlatformAdmin, addGirlsTeam);

// Point entries (girls standings)
router.get('/point-entries', requirePlatformAdmin, listPointEntries);
router.post('/point-entries', requirePlatformAdmin, createPointEntry);

// Phase 2 — registration workflows
router.get('/workflows/pending-count', requirePlatformAdmin, getWorkflowPendingCount);
router.get('/workflows', requirePlatformAdmin, listWorkflowQueues);
router.get(
  '/workflows/user-search',
  requirePlatformAdmin,
  adminSearchLimiter,
  searchIdentityUsers
);
router.post('/users/identity', requirePlatformAdmin, assignUserIdentity);
router.patch('/requests/creation/:id', requirePlatformAdmin, reviewCreationRequest);
router.patch('/requests/join/:id', requirePlatformAdmin, reviewJoinRequest);
router.patch('/requests/transfer/:id', requirePlatformAdmin, reviewTransferRequest);

// User role management
router.get('/users', requirePlatformAdmin, adminSearchLimiter, searchAdminUsers);
router.patch('/users/:id/role', requirePlatformAdmin, setAdminUserRole);

// Squad captain selection (platform admin)
router.get('/teams/:teamId/captain-candidates', requirePlatformAdmin, listCaptainCandidates);
router.patch('/teams/:teamId/captain', requirePlatformAdmin, setTeamCaptain);

export default router;
