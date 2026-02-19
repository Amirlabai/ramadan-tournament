import { Router } from 'express';
import multer from 'multer';
import { importPlayers, getBannedWords, addBannedWord, removeBannedWord, getAllComments, deleteComment, getPendingPhotos, approvePhoto, rejectPhoto, deletePlayerPhoto } from '../controllers/adminController';
import { authenticate } from '../middleware/auth';
import os from 'os';

const router = Router();
const upload = multer({ dest: os.tmpdir() });

router.post('/import-players', authenticate, upload.single('file'), importPlayers);

// Banned words management
router.get('/banned-words', authenticate, getBannedWords);
router.post('/banned-words', authenticate, addBannedWord);
router.delete('/banned-words/:id', authenticate, removeBannedWord);

// Comment management
router.get('/comments', authenticate, getAllComments);
router.delete('/comments/:id', authenticate, deleteComment);

// Photo approval
router.get('/photos/pending', authenticate, getPendingPhotos);
router.post('/photos/approve', authenticate, approvePhoto);
router.post('/photos/reject', authenticate, rejectPhoto);
router.post('/photos/delete', authenticate, deletePlayerPhoto);

export default router;
