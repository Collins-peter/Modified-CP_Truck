import { pool } from '../config/db.mjs';
import { geocodeAddress, getDistanceAndEta, isLocationInEnugu } from '../config/googleMaps.mjs';
import { evaluateFraudRisk } from '../services/fraudDetectionService.mjs';

// ============================================
// CREATE DISPATCH REQUEST (Customer)
// Customer specifies pickup, destination, package
// details, and receiver info. Status starts as 'pending'
// until admin reviews/approves after payment.
//
// Both pickup and destination are restricted to Enugu State, Nigeria.
// Distance, duration, and predicted delivery time are
// calculated server-side via Google Maps — never trusted
// from the client.
// ============================================
export const createRequest = async (req, res) => {
  const customerId = req.user.id;
  const {
    pickup_address,
    pickup_lat,
    pickup_lng,
    destination_address,
    destination_lat,
    destination_lng,
    package_description,
    package_weight,
    package_value,
    receiver_name,
    receiver_phone,
    receiver_address,
  } = req.body;

  try {
    // Required fields validation
    if (
      !pickup_address ||
      !destination_address ||
      !package_description ||
      !receiver_name ||
      !receiver_phone
    ) {
      return res.status(400).json({
        message:
          'pickup_address, destination_address, package_description, receiver_name, and receiver_phone are required.',
      });
    }

    // Resolve coordinates: prefer what the frontend sent (e.g. from
    // Google Places Autocomplete / a map pin), fall back to geocoding
    // the typed address if coordinates weren't provided.
    let resolvedPickup = { lat: pickup_lat, lng: pickup_lng };
    if (!pickup_lat || !pickup_lng) {
      resolvedPickup = await geocodeAddress(pickup_address);
    }

    let resolvedDestination = { lat: destination_lat, lng: destination_lng };
    if (!destination_lat || !destination_lng) {
      resolvedDestination = await geocodeAddress(destination_address);
    }

    // Validation: enforce that pickup & destination are strictly within Enugu State
    if (!isLocationInEnugu(pickup_address, resolvedPickup.lat, resolvedPickup.lng)) {
      return res.status(400).json({
        message:
          'Pickup address must be within Enugu State, Nigeria. CP Truck currently operates exclusively within Enugu State.',
      });
    }

    if (!isLocationInEnugu(destination_address, resolvedDestination.lat, resolvedDestination.lng)) {
      return res.status(400).json({
        message:
          'Destination address must be within Enugu State, Nigeria. CP Truck currently operates exclusively within Enugu State.',
      });
    }

    // Calculate real distance, ETA, and a predicted delivery time
    const { distanceKm, durationMinutes, predictedDeliveryTime } = await getDistanceAndEta(
      resolvedPickup.lat,
      resolvedPickup.lng,
      resolvedDestination.lat,
      resolvedDestination.lng
    );

    const [result] = await pool.query(
      `INSERT INTO dispatch_requests (
        customer_id, pickup_address, pickup_lat, pickup_lng,
        destination_address, destination_lat, destination_lng,
        package_description, package_weight, package_value,
        receiver_name, receiver_phone, receiver_address,
        distance_km, estimated_duration_minutes, predicted_delivery_time,
        request_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        customerId,
        pickup_address,
        resolvedPickup.lat,
        resolvedPickup.lng,
        destination_address,
        resolvedDestination.lat,
        resolvedDestination.lng,
        package_description,
        package_weight || null,
        package_value || null,
        receiver_name,
        receiver_phone,
        receiver_address || null,
        distanceKm,
        durationMinutes,
        predictedDeliveryTime,
      ]
    );

    // Run fraud risk evaluation now that the request exists in the DB
    // (the rules need the row's own data — distance, value, etc).
    // This never blocks the customer from submitting; it just silently
    // scores the request for the admin to see on their dashboard.
    await evaluateFraudRisk(result.insertId);

    const [rows] = await pool.query('SELECT * FROM dispatch_requests WHERE id = ?', [
      result.insertId,
    ]);

    return res.status(201).json({
      message: 'Dispatch request created successfully. Awaiting admin approval.',
      request: rows[0],
    });
  } catch (err) {
    console.error('Create request error:', err);
    return res.status(500).json({
      message: err.message || 'Server error while creating request.',
    });
  }
};

// ============================================
// GET MY REQUESTS (Customer)
// Returns all requests belonging to the logged-in customer.
// ============================================
export const getMyRequests = async (req, res) => {
  const customerId = req.user.id;

  try {
    const [rows] = await pool.query(
      `SELECT * FROM dispatch_requests WHERE customer_id = ? ORDER BY created_at DESC`,
      [customerId]
    );

    return res.status(200).json({ requests: rows });
  } catch (err) {
    console.error('Get my requests error:', err);
    return res.status(500).json({ message: 'Server error while fetching requests.' });
  }
};

// ============================================
// GET SINGLE REQUEST (Customer who owns it, or Admin)
// ============================================
export const getRequestById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query('SELECT * FROM dispatch_requests WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    const request = rows[0];

    // Customers can only view their own request; admins can view any.
    if (req.user.role === 'customer' && request.customer_id !== req.user.id) {
      return res.status(403).json({ message: 'You do not have access to this request.' });
    }

    return res.status(200).json({ request });
  } catch (err) {
    console.error('Get request by id error:', err);
    return res.status(500).json({ message: 'Server error while fetching request.' });
  }
};

// ============================================
// GET ALL REQUESTS (Admin)
// Supports optional ?status=pending|approved|rejected|assigned|in_transit|delivered|cancelled
// Also returns quick counts by status for dashboard cards.
// ============================================
export const getAllRequests = async (req, res) => {
  const { status } = req.query;

  const validStatuses = [
    'pending',
    'approved',
    'rejected',
    'assigned',
    'in_transit',
    'delivered',
    'cancelled',
  ];

  try {
    let query = `
      SELECT dr.*, u.full_name AS customer_name, u.phone AS customer_phone, u.email AS customer_email
      FROM dispatch_requests dr
      JOIN users u ON dr.customer_id = u.id
    `;
    const params = [];

    if (status) {
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }
      query += ' WHERE dr.request_status = ?';
      params.push(status);
    }

    query += ' ORDER BY dr.created_at DESC';

    const [rows] = await pool.query(query, params);

    // Dashboard summary counts
    const [countRows] = await pool.query(
      `SELECT request_status, COUNT(*) AS count FROM dispatch_requests GROUP BY request_status`
    );
    const counts = countRows.reduce((acc, row) => {
      acc[row.request_status] = row.count;
      return acc;
    }, {});

    return res.status(200).json({ requests: rows, counts });
  } catch (err) {
    console.error('Get all requests error:', err);
    return res.status(500).json({ message: 'Server error while fetching requests.' });
  }
};

// ============================================
// UPDATE REQUEST STATUS (Admin)
// Used for approve / reject / cancel actions.
// When approving, admin must also set delivery_fee —
// the customer can't pay until a fee exists.
// Assigning a rider + generating tracking ID happens
// in a separate step (tracking module), after payment.
// ============================================
export const updateRequestStatus = async (req, res) => {
  const { id } = req.params;
  const { request_status, delivery_fee } = req.body;

  const allowedStatuses = ['approved', 'rejected', 'cancelled'];

  try {
    if (!allowedStatuses.includes(request_status)) {
      return res.status(400).json({
        message: `request_status must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    const [rows] = await pool.query('SELECT * FROM dispatch_requests WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    // Approving a request requires a delivery fee to be set (either now,
    // or already present from a previous update), since the customer's
    // payment amount is calculated from it.
    if (request_status === 'approved') {
      const feeToUse = delivery_fee !== undefined ? delivery_fee : rows[0].delivery_fee;
      if (!feeToUse || feeToUse <= 0) {
        return res.status(400).json({
          message: 'delivery_fee must be provided (and greater than 0) when approving a request.',
        });
      }

      await pool.query(
        'UPDATE dispatch_requests SET request_status = ?, delivery_fee = ? WHERE id = ?',
        [request_status, feeToUse, id]
      );
    } else {
      await pool.query('UPDATE dispatch_requests SET request_status = ? WHERE id = ?', [
        request_status,
        id,
      ]);
    }

    const [updated] = await pool.query('SELECT * FROM dispatch_requests WHERE id = ?', [id]);

    return res.status(200).json({
      message: `Request ${request_status} successfully.`,
      request: updated[0],
    });
  } catch (err) {
    console.error('Update request status error:', err);
    return res.status(500).json({ message: 'Server error while updating request status.' });
  }
};
