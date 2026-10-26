import { pool } from '../config/db.mjs';
import { generateTrackingId } from '../utils/generateTrackingId.mjs';
import { getDistanceAndEta } from '../config/googleMaps.mjs';

// ============================================
// GET AVAILABLE RIDERS (Admin)
// Used when admin is picking who to assign a package to.
// ============================================
export const getAvailableRiders = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.phone, u.email,
              rp.vehicle_type, rp.plate_number, rp.rating, rp.total_deliveries,
              rp.current_lat, rp.current_lng, rp.availability
       FROM users u
       JOIN rider_profiles rp ON u.id = rp.user_id
       WHERE u.role = 'rider' AND rp.availability = 'available' AND u.status = 'active'`
    );

    return res.status(200).json({ riders: rows });
  } catch (err) {
    console.error('Get available riders error:', err);
    return res.status(500).json({ message: 'Server error while fetching riders.' });
  }
};

// ============================================
// GENERATE TRACKING ID + ASSIGN RIDER (Admin)
// Called after payment succeeds. Creates the tracking
// record, links a rider, moves the request to 'assigned',
// and marks the rider as busy.
// ============================================
export const generateTracking = async (req, res) => {
  const { request_id, rider_id } = req.body;

  try {
    if (!request_id || !rider_id) {
      return res.status(400).json({ message: 'request_id and rider_id are required.' });
    }

    // 1. Confirm the request exists and is approved
    const [requestRows] = await pool.query('SELECT * FROM dispatch_requests WHERE id = ?', [
      request_id,
    ]);
    if (requestRows.length === 0) {
      return res.status(404).json({ message: 'Request not found.' });
    }
    const request = requestRows[0];

    if (request.request_status !== 'approved') {
      return res.status(400).json({
        message: `Request must be in 'approved' status before assigning a rider. Current: ${request.request_status}.`,
      });
    }

    // 2. Confirm payment has actually been made
    const [paymentRows] = await pool.query(
      `SELECT * FROM payments WHERE request_id = ? AND payment_status = 'successful'`,
      [request_id]
    );
    if (paymentRows.length === 0) {
      return res.status(400).json({
        message: 'No successful payment found for this request. Cannot assign a rider yet.',
      });
    }

    // 3. Confirm a tracking record doesn't already exist for this request
    const [existingTracking] = await pool.query('SELECT id FROM tracking WHERE request_id = ?', [
      request_id,
    ]);
    if (existingTracking.length > 0) {
      return res.status(409).json({ message: 'A tracking ID already exists for this request.' });
    }

    // 4. Confirm the rider exists and is available
    const [riderRows] = await pool.query(
      `SELECT u.id, rp.availability FROM users u
       JOIN rider_profiles rp ON u.id = rp.user_id
       WHERE u.id = ? AND u.role = 'rider'`,
      [rider_id]
    );
    if (riderRows.length === 0) {
      return res.status(404).json({ message: 'Rider not found.' });
    }
    if (riderRows[0].availability !== 'available') {
      return res.status(400).json({ message: 'This rider is not currently available.' });
    }

    // 5. Generate a unique tracking ID (retry on the rare collision)
    let trackingId;
    let isUnique = false;
    while (!isUnique) {
      trackingId = generateTrackingId();
      const [check] = await pool.query('SELECT id FROM tracking WHERE tracking_id = ?', [trackingId]);
      if (check.length === 0) isUnique = true;
    }

    // 6. Create the tracking record
    const [trackingResult] = await pool.query(
      `INSERT INTO tracking (request_id, tracking_id, rider_id, current_status, current_lat, current_lng)
       VALUES (?, ?, ?, 'pending_pickup', ?, ?)`,
      [request_id, trackingId, rider_id, request.pickup_lat || null, request.pickup_lng || null]
    );

    // 7. Log the first tracking history entry
    await pool.query(
      `INSERT INTO tracking_history (tracking_id, status, note, updated_by)
       VALUES (?, 'pending_pickup', 'Rider assigned. Awaiting pickup.', ?)`,
      [trackingResult.insertId, req.user.id]
    );

    // 8. Update the request status to 'assigned'
    await pool.query(`UPDATE dispatch_requests SET request_status = 'assigned' WHERE id = ?`, [
      request_id,
    ]);

    // 9. Mark the rider as busy
    await pool.query(`UPDATE rider_profiles SET availability = 'busy' WHERE user_id = ?`, [
      rider_id,
    ]);

    const [finalTracking] = await pool.query('SELECT * FROM tracking WHERE id = ?', [
      trackingResult.insertId,
    ]);

    return res.status(201).json({
      message: 'Tracking ID generated and rider assigned successfully.',
      tracking: finalTracking[0],
    });
  } catch (err) {
    console.error('Generate tracking error:', err);
    return res.status(500).json({ message: 'Server error while generating tracking.' });
  }
};

// ============================================
// TRACK PACKAGE BY TRACKING ID (Customer)
// Returns tracking status, ETA, and rider details.
// ============================================
export const trackByTrackingId = async (req, res) => {
  const { trackingId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT t.*, dr.pickup_address, dr.destination_address, dr.package_description,
              dr.receiver_name, dr.receiver_phone, dr.predicted_delivery_time, dr.customer_id,
              u.full_name AS rider_name, u.phone AS rider_phone,
              rp.vehicle_type, rp.plate_number, rp.rating
       FROM tracking t
       JOIN dispatch_requests dr ON t.request_id = dr.id
       LEFT JOIN users u ON t.rider_id = u.id
       LEFT JOIN rider_profiles rp ON t.rider_id = rp.user_id
       WHERE t.tracking_id = ?`,
      [trackingId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No package found with this tracking ID.' });
    }

    const tracking = rows[0];

    // If a customer is checking, make sure it's their own package
    if (req.user && req.user.role === 'customer' && tracking.customer_id !== req.user.id) {
      return res.status(403).json({ message: 'This tracking ID does not belong to your account.' });
    }

    // Include status history for a visual timeline on the frontend
    const [history] = await pool.query(
      `SELECT status, note, lat, lng, created_at FROM tracking_history
       WHERE tracking_id = ? ORDER BY created_at ASC`,
      [tracking.id]
    );

    return res.status(200).json({ tracking, history });
  } catch (err) {
    console.error('Track by tracking id error:', err);
    return res.status(500).json({ message: 'Server error while tracking package.' });
  }
};

// ============================================
// GET MY DELIVERIES (Rider)
// All packages currently or previously assigned to this rider.
// ============================================
export const getMyDeliveries = async (req, res) => {
  const riderId = req.user.id;

  try {
    const [rows] = await pool.query(
      `SELECT t.*, dr.pickup_address, dr.destination_address, dr.package_description,
              dr.receiver_name, dr.receiver_phone
       FROM tracking t
       JOIN dispatch_requests dr ON t.request_id = dr.id
       WHERE t.rider_id = ?
       ORDER BY t.created_at DESC`,
      [riderId]
    );

    return res.status(200).json({ deliveries: rows });
  } catch (err) {
    console.error('Get my deliveries error:', err);
    return res.status(500).json({ message: 'Server error while fetching deliveries.' });
  }
};

// ============================================
// UPDATE DELIVERY STATUS (Rider)
// Moves a package through: pending_pickup -> picked_up -> in_transit -> delivered
// Enforces the status can only move forward in order.
// ============================================
export const updateDeliveryStatus = async (req, res) => {
  const { id } = req.params; // tracking record id
  const { status, lat, lng, note } = req.body;
  const riderId = req.user.id;

  const statusOrder = ['pending_pickup', 'picked_up', 'in_transit', 'delivered'];

  try {
    if (!statusOrder.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${statusOrder.join(', ')}` });
    }

    const [rows] = await pool.query('SELECT * FROM tracking WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Tracking record not found.' });
    }

    const tracking = rows[0];

    // Only the assigned rider can update this delivery
    if (tracking.rider_id !== riderId) {
      return res.status(403).json({ message: 'You are not assigned to this delivery.' });
    }

    // Enforce forward-only progression (can't go from delivered back to picked_up, etc.)
    const currentIndex = statusOrder.indexOf(tracking.current_status);
    const newIndex = statusOrder.indexOf(status);
    if (newIndex <= currentIndex) {
      return res.status(400).json({
        message: `Cannot move status backward or repeat. Current status: ${tracking.current_status}.`,
      });
    }

    // Build the update dynamically depending on which status we're moving to
    const updates = { current_status: status };
    if (lat) updates.current_lat = lat;
    if (lng) updates.current_lng = lng;
    if (status === 'picked_up') updates.picked_up_at = new Date();
    if (status === 'delivered') updates.delivered_at = new Date();

    const setClause = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(', ');
    const values = Object.values(updates);

    await pool.query(`UPDATE tracking SET ${setClause} WHERE id = ?`, [...values, id]);

    // Log to history
    await pool.query(
      `INSERT INTO tracking_history (tracking_id, status, note, lat, lng, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, status, note || null, lat || null, lng || null, riderId]
    );

    // Keep dispatch_requests.request_status in sync
    const requestStatusMap = {
      picked_up: 'in_transit', // treat pickup as the start of transit for the request-level status
      in_transit: 'in_transit',
      delivered: 'delivered',
    };
    if (requestStatusMap[status]) {
      await pool.query('UPDATE dispatch_requests SET request_status = ? WHERE id = ?', [
        requestStatusMap[status],
        tracking.request_id,
      ]);
    }

    // On delivery, free up the rider and bump their delivery count
    if (status === 'delivered') {
      await pool.query(
        `UPDATE rider_profiles SET availability = 'available', total_deliveries = total_deliveries + 1
         WHERE user_id = ?`,
        [riderId]
      );
    }

    const [updated] = await pool.query('SELECT * FROM tracking WHERE id = ?', [id]);

    return res.status(200).json({
      message: `Delivery status updated to '${status}'.`,
      tracking: updated[0],
    });
  } catch (err) {
    console.error('Update delivery status error:', err);
    return res.status(500).json({ message: 'Server error while updating delivery status.' });
  }
};

// ============================================
// UPDATE RIDER LOCATION (Rider)
// Called periodically by the rider's app/browser (e.g. every
// 15-30 seconds while a delivery is active) to ping their current
// GPS position. Every ping recalculates the live distance/ETA to
// the destination via Google Maps and refreshes
// dispatch_requests.predicted_delivery_time, so the customer's
// tracking page always reflects an up-to-date arrival estimate
// instead of a stale one calculated at request creation.
//
// Note: this only recalculates while the package is actively
// moving (picked_up or in_transit) — pinging before pickup or
// after delivery wouldn't represent a meaningful ETA.
// ============================================
export const updateRiderLocation = async (req, res) => {
  const { id } = req.params; // tracking record id
  const { lat, lng } = req.body;
  const riderId = req.user.id;

  try {
    if (!lat || !lng) {
      return res.status(400).json({ message: 'lat and lng are required.' });
    }

    const [rows] = await pool.query(
      `SELECT t.*, dr.destination_lat, dr.destination_lng
       FROM tracking t
       JOIN dispatch_requests dr ON t.request_id = dr.id
       WHERE t.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Tracking record not found.' });
    }

    const tracking = rows[0];

    if (tracking.rider_id !== riderId) {
      return res.status(403).json({ message: 'You are not assigned to this delivery.' });
    }

    // Always update the rider's raw position
    await pool.query('UPDATE tracking SET current_lat = ?, current_lng = ? WHERE id = ?', [
      lat,
      lng,
      id,
    ]);
    await pool.query('UPDATE rider_profiles SET current_lat = ?, current_lng = ? WHERE user_id = ?', [
      lat,
      lng,
      riderId,
    ]);

    // Only recalculate ETA while the delivery is actively moving
    const activeStatuses = ['picked_up', 'in_transit'];
    let liveEta = null;

    if (activeStatuses.includes(tracking.current_status) && tracking.destination_lat && tracking.destination_lng) {
      const { distanceKm, durationMinutes, predictedDeliveryTime } = await getDistanceAndEta(
        lat,
        lng,
        tracking.destination_lat,
        tracking.destination_lng
      );

      await pool.query('UPDATE dispatch_requests SET predicted_delivery_time = ? WHERE id = ?', [
        predictedDeliveryTime,
        tracking.request_id,
      ]);

      liveEta = { distanceKm, durationMinutes, predictedDeliveryTime };
    }

    return res.status(200).json({
      message: 'Location updated.',
      location: { lat, lng },
      liveEta,
    });
  } catch (err) {
    console.error('Update rider location error:', err);
    return res.status(500).json({ message: err.message || 'Server error while updating location.' });
  }
};

// ============================================
// GET RIDER PROFILE (Rider)
// ============================================
export const getRiderProfile = async (req, res) => {
  const riderId = req.user.id;

  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone,
              rp.vehicle_type, rp.plate_number, rp.availability, rp.rating, rp.total_deliveries,
              rp.current_lat, rp.current_lng
       FROM users u
       LEFT JOIN rider_profiles rp ON u.id = rp.user_id
       WHERE u.id = ?`,
      [riderId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Rider not found.' });
    }

    return res.status(200).json({ profile: rows[0] });
  } catch (err) {
    console.error('Get rider profile error:', err);
    return res.status(500).json({ message: 'Server error while fetching rider profile.' });
  }
};

// ============================================
// UPDATE RIDER AVAILABILITY (Rider)
// ============================================
export const updateRiderAvailability = async (req, res) => {
  const riderId = req.user.id;
  const { availability } = req.body;

  const validOptions = ['available', 'busy', 'offline'];

  try {
    if (!validOptions.includes(availability)) {
      return res.status(400).json({
        message: `availability must be one of: ${validOptions.join(', ')}`,
      });
    }

    await pool.query('UPDATE rider_profiles SET availability = ? WHERE user_id = ?', [
      availability,
      riderId,
    ]);

    return res.status(200).json({
      message: `Availability updated to '${availability}'.`,
      availability,
    });
  } catch (err) {
    console.error('Update availability error:', err);
    return res.status(500).json({ message: 'Server error while updating availability.' });
  }
};

// ============================================
// GET ALL TRACKING DELIVERIES (Admin)
// ============================================
export const getAllTrackingDeliveries = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, dr.pickup_address, dr.destination_address, dr.package_description,
              dr.receiver_name, dr.receiver_phone, dr.predicted_delivery_time,
              u.full_name AS rider_name, u.phone AS rider_phone,
              c.full_name AS customer_name, c.phone AS customer_phone
       FROM tracking t
       JOIN dispatch_requests dr ON t.request_id = dr.id
       LEFT JOIN users u ON t.rider_id = u.id
       LEFT JOIN users c ON dr.customer_id = c.id
       ORDER BY t.created_at DESC`
    );

    return res.status(200).json({ deliveries: rows });
  } catch (err) {
    console.error('Get all tracking deliveries error:', err);
    return res.status(500).json({ message: 'Server error while fetching deliveries.' });
  }
};
