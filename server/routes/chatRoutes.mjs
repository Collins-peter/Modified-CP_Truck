import express from 'express';
import { sendMessage, getMySessions, getSessionMessages } from '../controllers/chatController.mjs';
import { protect, authorize } from '../middleware/authMiddleware.mjs';

const router = express.Router();

router.use(protect);
router.use(authorize('customer'));

router.post('/message', sendMessage);
router.get('/sessions', getMySessions);
router.get('/sessions/:sessionId/messages', getSessionMessages);

export default router;
