import express from 'express';
import { castVote, getMyVote, getVoteResults } from '../controllers/voteController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Public endpoint (anyone can view results)
router.get('/results', getVoteResults);

// Protected endpoints (require login)
router.use(authenticate);

router.post('/', castVote);
router.get('/my', getMyVote);

export default router;
