import { pool } from '../config/db.mjs';

// ============================================
// GET ADMIN DASHBOARD STATS
// High-level summary cards for the admin overview
// ============================================
export const getAdminStats = async (req, res) => {
  try {
    const [userCounts] = await pool.query(
      `SELECT role, COUNT(*) AS count FROM users GROUP BY role`
    );
    const usersByRole = userCounts.reduce((acc, row) => {
      acc[row.role] = row.count;
      return acc;
    }, { customer: 0, rider: 0, admin: 0 });

    const [requestCounts] = await pool.query(
      `SELECT request_status, COUNT(*) AS count FROM dispatch_requests GROUP BY request_status`
    );
    const requestsByStatus = requestCounts.reduce((acc, row) => {
      acc[row.request_status] = row.count;
      return acc;
    }, {});

    const [totalRequestsRow] = await pool.query(
      `SELECT COUNT(*) AS total FROM dispatch_requests`
    );

    const [flaggedRow] = await pool.query(
      `SELECT COUNT(*) AS total_flagged FROM dispatch_requests WHERE is_flagged = TRUE`
    );

    const [revenueRow] = await pool.query(
      `SELECT IFNULL(SUM(amount), 0) AS total_revenue FROM payments WHERE payment_status = 'successful'`
    );

    const [activeRidersRow] = await pool.query(
      `SELECT COUNT(*) AS available_riders FROM rider_profiles WHERE availability = 'available'`
    );

    return res.status(200).json({
      stats: {
        totalCustomers: usersByRole.customer || 0,
        totalRiders: usersByRole.rider || 0,
        totalRequests: totalRequestsRow[0].total,
        requestsByStatus,
        flaggedFraudCount: flaggedRow[0].total_flagged,
        totalRevenue: Number(revenueRow[0].total_revenue),
        availableRidersCount: activeRidersRow[0].available_riders,
      },
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ message: 'Server error while fetching admin stats.' });
  }
};

// ============================================
// GET ALL USERS (Admin)
// ============================================
export const getAllUsers = async (req, res) => {
  const { role } = req.query;

  try {
    let query = `
      SELECT u.id, u.full_name, u.email, u.phone, u.role, u.status, u.created_at,
             rp.vehicle_type, rp.plate_number, rp.availability, rp.rating, rp.total_deliveries
      FROM users u
      LEFT JOIN rider_profiles rp ON u.id = rp.user_id
    `;
    const params = [];

    if (role) {
      query += ` WHERE u.role = ?`;
      params.push(role);
    }

    query += ` ORDER BY u.created_at DESC`;

    const [rows] = await pool.query(query, params);
    return res.status(200).json({ users: rows });
  } catch (err) {
    console.error('Get all users error:', err);
    return res.status(500).json({ message: 'Server error while fetching users.' });
  }
};

// ============================================
// UPDATE USER STATUS (Activate/Suspend)
// ============================================
export const updateUserStatus = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;

  const validStatuses = ['active', 'suspended'];

  try {
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
    return res.status(200).json({ message: `User status updated to ${status}.` });
  } catch (err) {
    console.error('Update user status error:', err);
    return res.status(500).json({ message: 'Server error while updating user status.' });
  }
};

// ============================================
// SYSTEM OPERATIONAL REPORT (Admin)
// ============================================
export const getOperationalReport = async (req, res) => {
  try {
    // Deliveries summary
    const [deliveries] = await pool.query(`
      SELECT 
        COUNT(*) AS total_shipments,
        SUM(CASE WHEN t.current_status = 'delivered' THEN 1 ELSE 0 END) AS delivered_count,
        SUM(CASE WHEN t.current_status = 'in_transit' THEN 1 ELSE 0 END) AS in_transit_count,
        SUM(CASE WHEN t.current_status = 'pending_pickup' THEN 1 ELSE 0 END) AS pending_pickup_count
      FROM tracking t
    `);

    // Top performing riders
    const [topRiders] = await pool.query(`
      SELECT u.full_name, rp.total_deliveries, rp.rating, rp.vehicle_type
      FROM users u
      JOIN rider_profiles rp ON u.id = rp.user_id
      ORDER BY rp.total_deliveries DESC LIMIT 5
    `);

    // Recent fraud activities
    const [recentFraud] = await pool.query(`
      SELECT fl.*, u.full_name AS customer_name
      FROM fraud_logs fl
      JOIN users u ON fl.customer_id = u.id
      ORDER BY fl.created_at DESC LIMIT 5
    `);

    return res.status(200).json({
      summary: deliveries[0],
      topRiders,
      recentFraud,
    });
  } catch (err) {
    console.error('Operational report error:', err);
    return res.status(500).json({ message: 'Server error while generating report.' });
  }
};
