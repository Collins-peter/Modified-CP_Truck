import crypto from 'crypto';

// Generates a human-friendly, unique tracking ID.
// Format: CPT-YYYYMMDD-XXXX (e.g. CPT-20260907-4F2A)
// The date makes IDs easy to sort/reason about visually,
// and the random suffix keeps them unique even if several
// requests are approved on the same day.
export const generateTrackingId = () => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 hex chars

  return `CPT-${datePart}-${randomPart}`;
};
