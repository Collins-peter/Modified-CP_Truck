import { verifyToken } from '../utils/jwt.mjs';

// Verifies the JWT sent in the Authorization header.
// Expected format: "Authorization: Bearer <token>"
export const protect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Attach decoded user info (id, role, email) to the request
    // so controllers can use it without re-querying the DB.
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

// Restricts a route to specific roles.
// Usage: router.get('/admin/stuff', protect, authorize('admin'), controllerFn)
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. This route is restricted to: ${allowedRoles.join(', ')}`,
      });
    }
    next();
  };
};
