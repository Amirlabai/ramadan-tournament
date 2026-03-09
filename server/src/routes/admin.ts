import { Router } from 'express';
import multer from 'multer';
import { importPlayers, getBannedWords, addBannedWord, removeBannedWord, getAllComments, deleteComment, getPendingPhotos, approvePhoto, rejectPhoto, deletePlayerPhoto } from '../controllers/adminController';
import { getPendingTeamRequests, approveTeamRequest, getUserMappings, updateUserMapping } from '../controllers/userController';
import { authenticate, authorize } from '../middleware/auth';
import os from 'os';

const router = Router();
const upload = multer({ dest: os.tmpdir() });

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

// User-team mappings (admin can view all and override any)
router.get('/user-mappings', authenticate, authorize(['Admin', 'admin']), getUserMappings);
router.patch('/user-mappings/:userId', authenticate, authorize(['Admin', 'admin']), updateUserMapping);

export default router;