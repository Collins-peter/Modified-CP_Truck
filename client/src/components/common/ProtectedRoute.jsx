import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Wraps a route and ensures:
// 1. The user is logged in (otherwise -> /login)
// 2. The user's role is allowed for this route (otherwise -> their own dashboard)
//
// Usage: <ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    // Still checking localStorage/session on first load — avoid a
    // flash-redirect to /login before we actually know the auth state.
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Logged in, but wrong role for this page — send them to their own dashboard
    // instead of showing a confusing blank/forbidden page.
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  }

  return children;
};

export default ProtectedRoute;
