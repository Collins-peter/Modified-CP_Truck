import crypto from 'crypto';
import { pool } from '../config/db.mjs';
import { initializeTransaction, verifyTransaction } from '../config/paystack.mjs';

// Generates a unique payment reference.
// Format: CPT-PAY-<timestamp>-<random hex>
const generateReference = () => {
  return `CPT-PAY-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`.toUpperCase();
};

// ============================================
// INITIATE PAYMENT (Customer)
// Customer pays for an already-approved request.
// Returns a Paystack authorization_url the frontend
// redirects the customer to.
// ============================================
export const initiatePayment = async (req, res) => {
  const customerId = req.user.id;
  const { request_id } = req.body;

  try {
    if (!request_id) {
      return res.status(400).json({ message: 'request_id is required.' });
    }

    // Fetch the request and confirm it belongs to this customer
    const [requestRows] = await pool.query(
      'SELECT * FROM dispatch_requests WHERE id = ? AND customer_id = ?',
      [request_id, customerId]
    );

    if (requestRows.length === 0) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    const request = requestRows[0];

    if (request.request_status !== 'approved') {
      return res.status(400).json({
        message: `This request must be approved by admin before payment. Current status: ${request.request_status}.`,
      });
    }

    if (!request.delivery_fee || request.delivery_fee <= 0) {
      return res.status(400).json({
        message: 'No delivery fee has been set for this request yet. Contact admin.',
      });
    }

    // Prevent duplicate payment if one is already successful
    const [existingPayment] = await pool.query(
      `SELECT * FROM payments WHERE request_id = ? AND payment_status = 'successful'`,
      [request_id]
    );
    if (existingPayment.length > 0) {
      return res.status(409).json({ message: 'This request has already been paid for.' });
    }

    // Get customer email for Paystack
    const [customerRows] = await pool.query('SELECT email FROM users WHERE id = ?', [customerId]);
    const customerEmail = customerRows[0].email;

    const reference = generateReference();
    const callbackUrl = `${process.env.CLIENT_URL}/payment/callback`;

    const paystackData = await initializeTransaction({
      email: customerEmail,
      amountInNaira: request.delivery_fee,
      reference,
      callback_url: callbackUrl,
    });

    // Record the payment as pending
    await pool.query(
      `INSERT INTO payments (request_id, customer_id, amount, payment_method, payment_reference, payment_status)
       VALUES (?, ?, ?, 'paystack', ?, 'pending')`,
      [request_id, customerId, request.delivery_fee, reference]
    );

    return res.status(200).json({
      message: 'Payment initialized. Redirect customer to authorization_url.',
      authorization_url: paystackData.authorization_url,
      reference,
    });
  } catch (err) {
    console.error('Initiate payment error:', err);
    return res.status(500).json({ message: err.message || 'Server error while initiating payment.' });
  }
};

// ============================================
// VERIFY PAYMENT (Callback — hit by frontend after
// Paystack redirects the customer back)
// This is a convenience path for immediate UI feedback.
// The webhook below is the SOURCE OF TRUTH, since a
// customer closing the tab early would skip this route.
// ============================================
export const verifyPayment = async (req, res) => {
  const { reference } = req.params;

  try {
    const paystackData = await verifyTransaction(reference);

    const [paymentRows] = await pool.query('SELECT * FROM payments WHERE payment_reference = ?', [
      reference,
    ]);

    if (paymentRows.length === 0) {
      return res.status(404).json({ message: 'Payment record not found.' });
    }

    const payment = paymentRows[0];

    if (paystackData.status === 'success') {
      // Only update if not already marked successful (idempotent — webhook may have already done this)
      if (payment.payment_status !== 'successful') {
        await pool.query(`UPDATE payments SET payment_status = 'successful' WHERE payment_reference = ?`, [
          reference,
        ]);
      }

      return res.status(200).json({
        message: 'Payment verified successfully.',
        status: 'successful',
        request_id: payment.request_id,
      });
    } else {
      await pool.query(`UPDATE payments SET payment_status = 'failed' WHERE payment_reference = ?`, [
        reference,
      ]);
      return res.status(200).json({ message: 'Payment was not successful.', status: 'failed' });
    }
  } catch (err) {
    console.error('Verify payment error:', err);
    return res.status(500).json({ message: err.message || 'Server error while verifying payment.' });
  }
};

// ============================================
// PAYSTACK WEBHOOK (source of truth for payment status)
// Paystack calls this directly whenever a transaction
// event happens. We verify the signature to make sure
// the request genuinely came from Paystack.
// ============================================
export const paystackWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];

    const expectedSignature = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(req.rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn('Invalid Paystack webhook signature received.');
      return res.status(401).json({ message: 'Invalid signature.' });
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const reference = event.data.reference;

      await pool.query(
        `UPDATE payments SET payment_status = 'successful' WHERE payment_reference = ? AND payment_status != 'successful'`,
        [reference]
      );

      console.log(`✅ Payment confirmed via webhook: ${reference}`);
    }

    // Always respond 200 quickly so Paystack doesn't retry unnecessarily
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ message: 'Webhook processing error.' });
  }
};

// ============================================
// GET PAYMENT STATUS (Customer) — checks local DB,
// useful for polling from the frontend without hitting Paystack again
// ============================================
export const getPaymentStatus = async (req, res) => {
  const { reference } = req.params;

  try {
    const [rows] = await pool.query('SELECT * FROM payments WHERE payment_reference = ?', [
      reference,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Payment not found.' });
    }

    // Customers can only check their own payments
    if (req.user.role === 'customer' && rows[0].customer_id !== req.user.id) {
      return res.status(403).json({ message: 'You do not have access to this payment.' });
    }

    return res.status(200).json({ payment: rows[0] });
  } catch (err) {
    console.error('Get payment status error:', err);
    return res.status(500).json({ message: 'Server error while fetching payment.' });
  }
};

// ============================================
// GET ALL PAYMENTS (Admin)
// ============================================
export const getAllPayments = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, u.full_name AS customer_name, u.email AS customer_email
       FROM payments p
       JOIN users u ON p.customer_id = u.id
       ORDER BY p.created_at DESC`
    );

    return res.status(200).json({ payments: rows });
  } catch (err) {
    console.error('Get all payments error:', err);
    return res.status(500).json({ message: 'Server error while fetching payments.' });
  }
};
