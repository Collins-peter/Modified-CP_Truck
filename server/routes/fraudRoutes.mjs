import express from 'express';
import {
  getFlaggedRequests,
  getFraudLogsForRequest,
  recheckRequest,
  clearFlag,
} from '../controllers/fraudController.mjs';
import { protect, authorize } from '../middleware/authMiddleware.mjs';

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/flagged', getFlaggedRequests);
router.get('/logs/:requestId', getFraudLogsForRequest);
router.post('/:requestId/recheck', recheckRequest);
router.patch('/:requestId/clear', clearFlag);

export default router;
