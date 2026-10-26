import { pool } from '../config/db.mjs';

// ============================================
// FRAUD DETECTION SERVICE
// Rule-based risk scoring, evaluated whenever a dispatch
// request is created (and re-runnable manually by admin).
// Each rule contributes a weight to a 0.00–1.00 risk score.
// Weights are additive and capped at 1.00.
//
// This approach is intentionally rule-based rather than a
// trained ML model — with no historical fraud dataset to
// train on, a hand-tuned rule set is more defensible and,
// crucially, fully explainable: every flagged request comes
// with a concrete, human-readable reason.
// ============================================

// Threshold above which a request is considered "flagged"
// for admin review. Tune this as you gather more real data.
const FLAG_THRESHOLD = 0.5;

// ------------------------------------------------
// Individual rule checks.
// Each returns { triggered: boolean, weight: number, reason: string }
// so they can be logged individually to fraud_logs.
// ------------------------------------------------

// Rule 1: Brand-new accounts attempting high-value dispatches are
// riskier — a fraudster has little to lose from a throwaway account.
const checkNewAccount = (customer) => {
  const accountAgeHours = (Date.now() - new Date(customer.created_at).getTime()) / (1000 * 60 * 60);

  if (accountAgeHours < 24) {
    return { triggered: true, weight: 0.2, reason: 'Customer account is less than 24 hours old.' };
  }
  if (accountAgeHours < 24 * 7) {
    return { triggered: true, weight: 0.1, reason: 'Customer account is less than 7 days old.' };
  }
  return { triggered: false, weight: 0, reason: null };
};

// Rule 2: Unusually high declared package value is a common vector
// for insurance/compensation fraud (claiming a package was lost or
// damaged to collect a payout, or laundering activity).
const checkHighPackageValue = (request) => {
  if (!request.package_value) return { triggered: false, weight: 0, reason: null };

  if (request.package_value > 500000) {
    return {
      triggered: true,
      weight: 0.35,
      reason: `Declared package value is very high (₦${Number(request.package_value).toLocaleString()}).`,
    };
  }
  if (request.package_value > 200000) {
    return {
      triggered: true,
      weight: 0.2,
      reason: `Declared package value is high (₦${Number(request.package_value).toLocaleString()}).`,
    };
  }
  return { triggered: false, weight: 0, reason: null };
};

// Rule 3: If the receiver's phone number is identical to the
// customer's own phone number, this may indicate self-dealing —
// e.g. gaming promotions, generating fake delivery history, or
// testing stolen payment methods with no real delivery risk.
const checkSelfDealing = (request, customer) => {
  if (request.receiver_phone === customer.phone) {
    return {
      triggered: true,
      weight: 0.15,
      reason: 'Receiver phone number is identical to the customer\'s own phone number.',
    };
  }
  return { triggered: false, weight: 0, reason: null };
};

// Rule 4: Pickup and destination that are effectively the same
// location don't make logistical sense for a real delivery and
// may indicate an attempt to exploit the platform (e.g. fee
// manipulation or fake delivery history).
const checkIdenticalLocations = (request) => {
  if (request.distance_km !== null && request.distance_km < 0.3) {
    return {
      triggered: true,
      weight: 0.2,
      reason: `Pickup and destination are unusually close (${request.distance_km} km apart).`,
    };
  }
  return { triggered: false, weight: 0, reason: null };
};

// Rule 5: Multiple failed payment attempts in a short window is a
// classic signal of card testing (a fraudster trying stolen card
// numbers to see which ones work).
const checkFailedPayments = async (customerId) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS failed_count FROM payments
     WHERE customer_id = ? AND payment_status = 'failed'
     AND created_at > (NOW() - INTERVAL 24 HOUR)`,
    [customerId]
  );

  const failedCount = rows[0].failed_count;

  if (failedCount >= 3) {
    return {
      triggered: true,
      weight: 0.2,
      reason: `Customer has had ${failedCount} failed payment attempts in the last 24 hours.`,
    };
  }
  return { triggered: false, weight: 0, reason: null };
};

// Rule 6: An unusually high number of dispatch requests in a short
// window may indicate automated/bot abuse of the platform rather
// than genuine delivery needs.
const checkRequestFrequency = async (customerId) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS request_count FROM dispatch_requests
     WHERE customer_id = ? AND created_at > (NOW() - INTERVAL 1 HOUR)`,
    [customerId]
  );

  const requestCount = rows[0].request_count;

  if (requestCount > 5) {
    return {
      triggered: true,
      weight: 0.2,
      reason: `Customer has submitted ${requestCount} requests in the last hour.`,
    };
  }
  return { triggered: false, weight: 0, reason: null };
};

// ============================================
// MAIN EVALUATION FUNCTION
// Runs all rules for a given request, persists the resulting
// score/flag/reasons to dispatch_requests, and logs each
// triggered rule individually to fraud_logs for audit purposes.
// ============================================
export const evaluateFraudRisk = async (requestId) => {
  const [requestRows] = await pool.query('SELECT * FROM dispatch_requests WHERE id = ?', [
    requestId,
  ]);
  if (requestRows.length === 0) {
    throw new Error('Request not found for fraud evaluation.');
  }
  const request = requestRows[0];

  const [customerRows] = await pool.query('SELECT * FROM users WHERE id = ?', [
    request.customer_id,
  ]);
  const customer = customerRows[0];

  // Run all rules (sync ones directly, async ones awaited)
  const results = [
    checkNewAccount(customer),
    checkHighPackageValue(request),
    checkSelfDealing(request, customer),
    checkIdenticalLocations(request),
    await checkFailedPayments(request.customer_id),
    await checkRequestFrequency(request.customer_id),
  ];

  const triggeredRules = results.filter((r) => r.triggered);

  // Sum weights, capped at 1.00
  const rawScore = triggeredRules.reduce((sum, r) => sum + r.weight, 0);
  const finalScore = Math.min(+rawScore.toFixed(2), 1.0);
  const isFlagged = finalScore >= FLAG_THRESHOLD;

  const combinedReason = triggeredRules.map((r) => r.reason).join(' | ') || null;

  // Persist to the request itself
  await pool.query(
    `UPDATE dispatch_requests SET fraud_score = ?, is_flagged = ?, flag_reason = ? WHERE id = ?`,
    [finalScore, isFlagged, combinedReason, requestId]
  );

  // Log each triggered rule individually for a full audit trail
  for (const rule of triggeredRules) {
    await pool.query(
      `INSERT INTO fraud_logs (request_id, customer_id, rule_triggered, risk_score, details)
       VALUES (?, ?, ?, ?, ?)`,
      [requestId, request.customer_id, rule.reason, rule.weight, combinedReason]
    );
  }

  return { score: finalScore, flagged: isFlagged, reasons: triggeredRules.map((r) => r.reason) };
};
