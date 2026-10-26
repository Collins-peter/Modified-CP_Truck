import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

// Creates a signed token containing the user's id and role.
// role is embedded here so we don't have to hit the DB on every
// request just to check permissions.
export const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
