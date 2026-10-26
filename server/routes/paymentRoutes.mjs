import express from 'express';
import {
  initiatePayment,
  verifyPayment,
  paystackWebhook,
  getPaymentStatus,
  getAllPayments,
} from '../controllers/paymentController.mjs';
import { protect, authorize } from '../middleware/authMiddleware.mjs';

const router = express.Router();

// Webhook must NOT go through protect (Paystack calls this directly,
// there's no user token — it's authenticated via signature instead).
router.post('/webhook', paystackWebhook);

// Everything below requires a logged-in user
router.use(protect);

router.post('/initiate', authorize('customer'), initiatePayment);
router.get('/verify/:reference', authorize('customer'), verifyPayment);
router.get('/status/:reference', authorize('customer', 'admin'), getPaymentStatus);
router.get('/', authorize('admin'), getAllPayments);

export default router;
