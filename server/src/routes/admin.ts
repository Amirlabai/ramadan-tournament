import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { importPlayers, getBannedWords, addBannedWord, removeBannedWord, getAllComments, deleteComment, getPendingPhotos, approvePhoto, rejectPhoto, deletePlayerPhoto, triggerAutomation } from '../controllers/adminController';
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
} from '../controllers/adminWorkflowController';
import { searchAdminUsers, setAdminUserRole } from '../controllers/adminUserController';
import { authenticate, authorize } from '../middleware/auth';
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

router.post('/import-players', authenticate, authorize(['Admin', 'admin']), upload.single('file'), importPlayers);

// Banned words management
router.get('/banned-words', authenticate, authorize(['Admin', 'admin']), getBannedWords);
router.post('/banned-words', authenticate, authorize(['Admin', 'admin']), addBannedWord);
router.delete('/banned-words/:id', authenticate, authorize(['Admin', 'admin']), removeBannedWord);

// Comment management
router.get('/comments', authenticate, authorize(['Admin', 'admin']), getAllComments);
router.delete('/comments/:id', authenticate, authorize(['Admin', 'admin']), deleteComment);

// Photo approval
router.get('/photos/pending', authenticate, authorize(['Admin', 'admin']), getPendingPhotos);
router.post('/photos/approve', authenticate, authorize(['Admin', 'admin']), approvePhoto);
router.post('/photos/reject', authenticate, authorize(['Admin', 'admin']), rejectPhoto);
router.post('/photos/delete', authenticate, authorize(['Admin', 'admin']), deletePlayerPhoto);

// Team creation requests
router.get('/team-requests', authenticate, authorize(['Admin', 'admin']), getPendingTeamRequests);
router.post('/team-requests/:userId', authenticate, authorize(['Admin', 'admin']), approveTeamRequest);

// News automation
router.post('/trigger-automation', authenticate, authorize(['Admin', 'admin']), triggerAutomation);

// Seasons (girls / points tournament)
router.get('/seasons', authenticate, authorize(['Admin', 'admin']), listSeasons);
router.get('/seasons/girls/summary', authenticate, authorize(['Admin', 'admin']), getGirlsAdminSummary);
router.post('/seasons/girls', authenticate, authorize(['Admin', 'admin']), createGirlsSeason);
router.post('/seasons/:seasonId/activate', authenticate, authorize(['Admin', 'admin']), activateSeason);
router.post('/seasons/:seasonId/teams', authenticate, authorize(['Admin', 'admin']), addGirlsTeam);

// Point entries (girls standings)
router.get('/point-entries', authenticate, authorize(['Admin', 'admin']), listPointEntries);
router.post('/point-entries', authenticate, authorize(['Admin', 'admin']), createPointEntry);

// Phase 2 — registration workflows
router.get('/workflows/pending-count', authenticate, authorize(['Admin', 'admin']), getWorkflowPendingCount);
router.get('/workflows', authenticate, authorize(['Admin', 'admin']), listWorkflowQueues);
router.get(
  '/workflows/user-search',
  authenticate,
  authorize(['Admin', 'admin']),
  adminSearchLimiter,
  searchIdentityUsers
);
router.post('/users/identity', authenticate, authorize(['Admin', 'admin']), assignUserIdentity);
router.patch('/requests/creation/:id', authenticate, authorize(['Admin', 'admin']), reviewCreationRequest);
router.patch('/requests/join/:id', authenticate, authorize(['Admin', 'admin']), reviewJoinRequest);
router.patch('/requests/transfer/:id', authenticate, authorize(['Admin', 'admin']), reviewTransferRequest);

// User role management
router.get('/users', authenticate, authorize(['Admin', 'admin']), adminSearchLimiter, searchAdminUsers);
router.patch('/users/:id/role', authenticate, authorize(['Admin', 'admin']), setAdminUserRole);

export default router;
