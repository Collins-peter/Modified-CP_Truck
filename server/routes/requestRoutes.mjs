import express from 'express';
import {
  createRequest,
  getMyRequests,
  getRequestById,
  getAllRequests,
  updateRequestStatus,
} from '../controllers/requestController.mjs';
import { protect, authorize } from '../middleware/authMiddleware.mjs';

const router = express.Router();

// All routes below require a logged-in user
router.use(protect);

// Customer routes
router.post('/', authorize('customer'), createRequest);
router.get('/my', authorize('customer'), getMyRequests);

// Admin routes
router.get('/', authorize('admin'), getAllRequests);
router.patch('/:id/status', authorize('admin'), updateRequestStatus);

// Shared route — customer (own request) or admin (any request).
// Ownership check happens inside the controller.
router.get('/:id', authorize('customer', 'admin'), getRequestById);

export default router;
