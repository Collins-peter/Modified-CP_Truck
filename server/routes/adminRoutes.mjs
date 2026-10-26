import express from 'express';
import {
  getAdminStats,
  getAllUsers,
  updateUserStatus,
  getOperationalReport,
} from '../controllers/adminController.mjs';
import { protect, authorize } from '../middleware/authMiddleware.mjs';

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getAdminStats);
router.get('/users', getAllUsers);
router.patch('/users/:userId/status', updateUserStatus);
router.get('/reports', getOperationalReport);

export default router;
