import bcrypt from 'bcryptjs';
import { pool } from '../config/db.mjs';
import { generateToken } from '../utils/jwt.mjs';

// ============================================
// REGISTER
// Handles customer, rider, and admin registration.
// NOTE: In production, admin accounts should NOT be
// self-registerable from a public endpoint — see note
// at the bottom of this file.
// ============================================
export const register = async (req, res) => {
  const { full_name, email, phone, password, role } = req.body;

  try {
    // Basic validation
    if (!full_name || !email || !phone || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Only allow 'customer' or 'rider' to self-register.
    // Admin accounts should be created manually/seeded — see note below.
    const allowedSelfRegisterRoles = ['customer', 'rider'];
    const finalRole = allowedSelfRegisterRoles.includes(role) ? role : 'customer';

    // Check if email already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, phone, password, role, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [full_name, email, phone, hashedPassword, finalRole]
    );

    const userId = result.insertId;

    // If registering as a rider, create their rider_profile row too
    if (finalRole === 'rider') {
      await pool.query(
        `INSERT INTO rider_profiles (user_id, availability) VALUES (?, 'offline')`,
        [userId]
      );
    }

    const newUser = {
      id: userId,
      full_name,
      email,
      role: finalRole,
    };

    const token = generateToken(newUser);

    return res.status(201).json({
      message: 'Registration successful.',
      user: newUser,
      token,
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Server error during registration.' });
  }
};

// ============================================
// LOGIN
// Same endpoint for all roles — the role comes back
// from the DB and the frontend redirects accordingly.
// ============================================
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = rows[0];

    if (user.status !== 'active') {
      return res.status(403).json({ message: `Account is ${user.status}. Contact support.` });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    return res.status(200).json({
      message: 'Login successful.',
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error during login.' });
  }
};

// ============================================
// GET CURRENT USER (used to re-check session on frontend refresh)
// ============================================
export const getMe = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, full_name, email, phone, role, status, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({ user: rows[0] });
  } catch (err) {
    console.error('GetMe error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/*
  NOTE ON ADMIN ACCOUNTS:
  For a BSc project, the simplest secure approach is to NOT expose
  admin registration via the API at all. Instead, create your admin
  account directly in the database (or via a one-time seed script),
  e.g.:

  INSERT INTO users (full_name, email, phone, password, role, status)
  VALUES ('Admin', 'admin@cptruck.com', '08000000000', '<bcrypt-hash>', 'admin', 'active');

  You can generate a bcrypt hash quickly with a small Node script,
  or I can generate a seed script for you if you'd like.
*/
