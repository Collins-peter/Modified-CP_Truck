import express from 'express';
import {
  getAvailableRiders,
  generateTracking,
  trackByTrackingId,
  getMyDeliveries,
  updateDeliveryStatus,
  updateRiderLocation,
  getRiderProfile,
  updateRiderAvailability,
  getAllTrackingDeliveries,
} from '../controllers/trackingController.mjs';
import { protect, authorize } from '../middleware/authMiddleware.mjs';

const router = express.Router();

router.use(protect);

// Admin routes
router.get('/', authorize('admin'), getAllTrackingDeliveries);
router.get('/riders/available', authorize('admin'), getAvailableRiders);
router.post('/generate', authorize('admin'), generateTracking);

// Rider routes
router.get('/rider/profile', authorize('rider'), getRiderProfile);
router.patch('/rider/availability', authorize('rider'), updateRiderAvailability);
router.get('/rider/my', authorize('rider'), getMyDeliveries);
router.patch('/:id/status', authorize('rider'), updateDeliveryStatus);
router.patch('/:id/location', authorize('rider'), updateRiderLocation);

// Shared — customer tracking their own package, or admin checking any package.
// Ownership check happens inside the controller.
router.get('/:trackingId', authorize('customer', 'admin'), trackByTrackingId);

export default router;
