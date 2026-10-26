import { pool } from '../config/db.mjs';
import { evaluateFraudRisk } from '../services/fraudDetectionService.mjs';

// ============================================
// GET FLAGGED REQUESTS (Admin)
// Requests currently flagged as high-risk, worst first.
// This is what an admin would check before approving anything.
// ============================================
export const getFlaggedRequests = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT dr.*, u.full_name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
       FROM dispatch_requests dr
       JOIN users u ON dr.customer_id = u.id
       WHERE dr.is_flagged = TRUE
       ORDER BY dr.fraud_score DESC, dr.created_at DESC`
    );

    return res.status(200).json({ flagged_requests: rows });
  } catch (err) {
    console.error('Get flagged requests error:', err);
    return res.status(500).json({ message: 'Server error while fetching flagged requests.' });
  }
};

// ============================================
// GET FRAUD LOGS FOR A REQUEST (Admin)
// Full audit trail of every rule that has ever triggered
// for this request — useful evidence for a manual decision.
// ============================================
export const getFraudLogsForRequest = async (req, res) => {
  const { requestId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT * FROM fraud_logs WHERE request_id = ? ORDER BY created_at DESC`,
      [requestId]
    );

    return res.status(200).json({ logs: rows });
  } catch (err) {
    console.error('Get fraud logs error:', err);
    return res.status(500).json({ message: 'Server error while fetching fraud logs.' });
  }
};

// ============================================
// RE-CHECK A REQUEST (Admin)
// Manually re-runs the rule evaluation — useful if the admin
// wants a fresh score after something has changed (e.g. more
// time has passed, or a payment attempt happened since).
// ============================================
export const recheckRequest = async (req, res) => {
  const { requestId } = req.params;

  try {
    const result = await evaluateFraudRisk(requestId);
    return res.status(200).json({
      message: 'Fraud risk re-evaluated.',
      ...result,
    });
  } catch (err) {
    console.error('Recheck request error:', err);
    return res.status(500).json({ message: err.message || 'Server error while re-checking request.' });
  }
};

// ============================================
// CLEAR A FLAG (Admin)
// Marks a request as manually reviewed and no longer flagged —
// for legitimate false positives. The original fraud_logs entries
// stay in place as a permanent audit record; only the "is_flagged"
// state changes.
// ============================================
export const clearFlag = async (req, res) => {
  const { requestId } = req.params;

  try {
    const [rows] = await pool.query('SELECT id FROM dispatch_requests WHERE id = ?', [requestId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    await pool.query(
      `UPDATE dispatch_requests SET is_flagged = FALSE, flag_reason = CONCAT(IFNULL(flag_reason, ''), ' [Cleared by admin after review]') WHERE id = ?`,
      [requestId]
    );

    return res.status(200).json({ message: 'Flag cleared. Request marked as reviewed.' });
  } catch (err) {
    console.error('Clear flag error:', err);
    return res.status(500).json({ message: 'Server error while clearing flag.' });
  }
};
